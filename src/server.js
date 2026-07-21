import './load-env.js'
import express from 'express'
import path from 'node:path'
import crypto from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { formatEther } from 'viem'
import { PROJECT_ROOT } from './load-env.js'
import { CHAIN, ADDRESSES, DROP_DEFAULTS, LIMITS, CHARITIES } from './config.js'
import { allLaunches, getLaunch, upsertLaunch } from './store.js'
import { createVaultWallet } from './vault.js'
import { normalizeDropConfig, computeSchedule, nextRound, validateSplitConfig } from './schedule.js'
import { getLaunchFee, readGraduation, readMarketCapUsd, readLaunchedToken, readTokenBranding, vaultBalances, rememberPool } from './chain.js'
import { startIndexer } from './indexer.js'

const app = express()
app.use(express.json({ limit: '1mb' }))

const FEE_MODES = ['default', 'holders', 'split', 'burn', 'charity']

// Public view of a launch: never expose anything vault-related beyond the address.
function publicLaunch (l) {
  const { adminNotes, ...rest } = l
  return rest
}

// ---- config for the frontend ------------------------------------------
app.get('/api/config', async (_req, res) => {
  let launchFee = null
  try { launchFee = formatEther(await getLaunchFee()) } catch { /* RPC down: form still renders */ }
  res.json({
    chain: { id: CHAIN.id, name: CHAIN.name, rpc: CHAIN.rpcUrls.default.http[0], explorer: CHAIN.blockExplorers.default.url },
    factory: ADDRESSES.factory,
    locker: ADDRESSES.locker,
    weth: ADDRESSES.weth,
    launchFeeEth: launchFee,
    launchConfigId: 0,
    dexId: 0,
    dropDefaults: DROP_DEFAULTS,
    limits: LIMITS,
    charities: CHARITIES,
    dryRun: process.env.DRY_RUN !== 'false',
  })
})

// ---- launch flow -------------------------------------------------------
// 1) prepare: reserve a fee vault for managed modes, register a draft
app.post('/api/launch/prepare', (req, res) => {
  const { feeMode, name, symbol, deployer, dropConfig, splitConfig } = req.body || {}
  if (!FEE_MODES.includes(feeMode)) return res.status(400).json({ error: 'feeMode must be one of ' + FEE_MODES.join(', ') })
  if (deployer && !/^0x[0-9a-fA-F]{40}$/.test(deployer)) return res.status(400).json({ error: 'bad deployer address' })

  const id = 'rd-' + crypto.randomBytes(4).toString('hex')
  const entry = {
    id,
    status: 'draft',
    feeMode,
    name: String(name || '').slice(0, 64) || null,
    symbol: String(symbol || '').slice(0, 16) || null,
    deployer: deployer || null,
    createdAt: new Date().toISOString(),
    roundsDone: 0,
    distributions: [],
  }

  if (feeMode === 'holders') {
    entry.dropConfig = normalizeDropConfig(dropConfig)
    if (entry.dropConfig.trigger === 'mcap' && !(entry.dropConfig.startCapUsd > 0)) {
      return res.status(400).json({ error: 'startCapUsd is required for market cap rounds' })
    }
  }
  if (feeMode === 'split') {
    const v = validateSplitConfig(splitConfig)
    if (v.error) return res.status(400).json({ error: v.error })
    entry.splitConfig = v.config
  }
  if (feeMode === 'charity') {
    const { charityId } = req.body.charityConfig || {}
    const c = CHARITIES.find(x => x.id === charityId)
    if (!c) return res.status(400).json({ error: 'pick a charity from the built-in list' })
    entry.charityConfig = { id: c.id, name: c.name, address: c.address, url: c.url, source: c.source, logo: c.logo }
  }

  if (feeMode === 'default') {
    entry.feeWallet = deployer || null // frontend falls back to the connected wallet
  } else {
    try {
      entry.feeWallet = createVaultWallet()
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  upsertLaunch(entry)
  res.json({ draftId: id, feeWallet: entry.feeWallet })
})

// 2) confirm: the launch page reports the tx hash (and token when known)
app.post('/api/launch/confirm', (req, res) => {
  const { draftId, txHash, token, deployer, name, symbol, logo } = req.body || {}
  const draft = getLaunch(String(draftId || ''))
  if (!draft) return res.status(404).json({ error: 'draft not found' })
  if (txHash && !/^0x[0-9a-fA-F]{64}$/.test(txHash)) return res.status(400).json({ error: 'bad tx hash' })
  if (token && !/^0x[0-9a-fA-F]{40}$/.test(token)) return res.status(400).json({ error: 'bad token address' })
  upsertLaunch({
    id: draft.id,
    status: token ? 'live' : 'pending',
    txHash: txHash || draft.txHash,
    token: token || draft.token,
    deployer: deployer || draft.deployer,
    name: name || draft.name,
    symbol: symbol || draft.symbol,
    logo: logo || draft.logo,
  })
  res.json({ ok: true, id: draft.id })
})

// Logo upload: try the pons IPFS uploader first (best for indexers), fall
// back to serving the file ourselves from public/uploads.
app.post('/api/upload/logo', express.raw({ type: 'image/*', limit: '4mb' }), async (req, res) => {
  if (!req.body?.length) return res.status(400).json({ error: 'no image data' })
  try {
    const form = new FormData()
    form.append('image', new Blob([req.body], { type: req.get('content-type') || 'image/png' }), 'logo.png')
    const r = await fetch('https://www.ponsfamily.com/api/ipfs/image', { method: 'POST', body: form, signal: AbortSignal.timeout(15000) })
    if (r.ok) {
      const j = await r.json().catch(() => null)
      const url = j?.url || j?.ipfs || (j?.cid && `ipfs://${j.cid}`) || (j?.hash && `ipfs://${j.hash}`)
      if (url) return res.json({ url, via: 'pons' })
    }
  } catch { /* pons unreachable: keep the launch flow alive with local hosting */ }
  const name = crypto.randomBytes(8).toString('hex') + '.png'
  const dir = path.join(PROJECT_ROOT, 'public', 'uploads')
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, name), req.body)
  res.json({ url: `${req.protocol}://${req.get('host')}/uploads/${name}`, via: 'local' })
})

// IPFS image proxy with in-memory cache: public gateways are slow and
// flaky, so the first fetch tries several and later hits are instant.
const ipfsCache = new Map()
app.get('/api/ipfs/:cid', async (req, res) => {
  const cid = req.params.cid
  if (!/^[a-zA-Z0-9]{10,100}$/.test(cid)) return res.status(400).end()
  const hit = ipfsCache.get(cid)
  if (hit) return res.set('cache-control', 'public, max-age=86400').type(hit.type).send(hit.buf)
  for (const gw of ['https://ipfs.io/ipfs/', 'https://dweb.link/ipfs/', 'https://w3s.link/ipfs/']) {
    try {
      const r = await fetch(gw + cid, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) continue
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.length > 3_000_000) break
      const type = r.headers.get('content-type') || 'image/png'
      if (ipfsCache.size > 300) ipfsCache.delete(ipfsCache.keys().next().value)
      ipfsCache.set(cid, { type, buf })
      return res.set('cache-control', 'public, max-age=86400').type(type).send(buf)
    } catch { /* next gateway */ }
  }
  res.status(404).end()
})

// schedule preview for the launch form infographic
app.post('/api/schedule/preview', (req, res) => {
  const cfg = normalizeDropConfig(req.body || {})
  res.json({ config: cfg, schedule: computeSchedule(cfg) })
})

// ---- public data -------------------------------------------------------
// Explore feed: PonsDrop launches only, enriched with on-chain price, cap,
// graduation and branding. One external pons launch rides along as a demo
// card so the page shows the format before our first launches land.
let exploreCache = { at: 0, data: null }
app.get('/api/explore', async (_req, res) => {
  if (exploreCache.data && Date.now() - exploreCache.at < 30_000) return res.json(exploreCache.data)
  const list = allLaunches().filter(l => l.status === 'live' || l.status === 'pending')
  const ours = list
    .filter(l => ['holders', 'split', 'burn', 'default'].includes(l.feeMode))
    .sort((a, b) => Number(b.launchBlock || 0) - Number(a.launchBlock || 0))

  const externals = list.filter(l => l.feeMode === 'external' && l.symbol && l.token)
  const demoAddr = (process.env.DEMO_TOKEN || '').toLowerCase()
  const demo = externals.find(l => l.token.toLowerCase() === demoAddr)
    || externals.find(l => l.symbol === 'PEPE')
    || externals[0]
    || null

  const items = [...ours, ...(demo ? [{ ...demo, demo: true }] : [])]
  const out = []
  for (const l of items.slice(0, 30)) {
    const entry = { ...publicLaunch(l) }
    try {
      if (l.token) {
        if (l.pool) rememberPool(l.token, l.pool)
        const info = await readLaunchedToken(l.token)
        if (info) {
          const [grad, mcap, brand] = await Promise.all([
            readGraduation(l.token),
            readMarketCapUsd(l.token, info),
            readTokenBranding(l.token),
          ])
          entry.graduated = grad.graduated
          entry.gradPct = grad.graduated ? 100 : Math.min(100, Math.round(Number(grad.pairedPrincipal) / Number(grad.threshold) * 100))
          if (mcap) {
            entry.mcapUsd = mcap.mcapUsd
            entry.priceUsd = mcap.priceWeth * mcap.ethUsd
          }
          entry.logo = entry.logo || brand.logo || null
          entry.description = entry.description || brand.description || null
        }
      }
    } catch { /* card renders with dashes if the RPC hiccups */ }
    out.push(entry)
  }
  exploreCache = { at: Date.now(), data: out }
  res.json(out)
})

app.get('/api/launches', (_req, res) => {
  const list = allLaunches()
    .filter(l => l.status === 'live' || l.status === 'pending')
    .sort((a, b) => Number(b.launchBlock || 0) - Number(a.launchBlock || 0))
  res.json(list.map(publicLaunch))
})

app.get('/api/token/:addr', async (req, res) => {
  const l = getLaunch(req.params.addr)
  const token = l?.token || (/^0x[0-9a-fA-F]{40}$/.test(req.params.addr) ? req.params.addr : null)
  if (!l && !token) return res.status(404).json({ error: 'not found' })

  const out = { launch: l ? publicLaunch(l) : null, onchain: null }
  if (token) {
    try {
      if (l?.pool) rememberPool(token, l.pool)
      const info = await readLaunchedToken(token)
      if (info) {
        const [grad, mcap] = await Promise.all([
          readGraduation(token),
          readMarketCapUsd(token, info),
        ])
        out.onchain = {
          deployer: info.deployer,
          supply: info.supply.toString(),
          poolFee: info.poolFee,
          graduated: grad.graduated,
          pairedPrincipalEth: formatEther(grad.pairedPrincipal),
          graduationThresholdEth: formatEther(grad.threshold),
          mcapUsd: mcap?.mcapUsd ?? null,
          priceWeth: mcap?.priceWeth ?? null,
        }
        if (l?.feeWallet && l.feeMode !== 'default' && l.feeMode !== 'external') {
          const b = await vaultBalances(l.feeWallet, token)
          out.vault = {
            address: l.feeWallet,
            eth: formatEther(b.eth),
            weth: formatEther(b.weth),
            token: formatEther(b.token),
          }
        }
      }
    } catch (e) {
      out.onchainError = e.shortMessage || e.message
    }
  }
  if (l?.feeMode === 'holders' && l.dropConfig) {
    out.schedule = computeSchedule(l.dropConfig)
    out.nextRound = nextRound(l.dropConfig, l.roundsDone || 0)
  }
  res.json(out)
})

// ---- admin (manual control, trench style) ------------------------------
function requireAdmin (req, res, next) {
  const token = process.env.ADMIN_TOKEN
  if (!token) return res.status(503).json({ error: 'ADMIN_TOKEN not configured' })
  if (req.get('x-admin-token') !== token) return res.status(401).json({ error: 'unauthorized' })
  next()
}

app.post('/api/admin/login', (req, res) => {
  const token = process.env.ADMIN_TOKEN
  if (!token) return res.status(503).json({ error: 'ADMIN_TOKEN not configured' })
  if ((req.body?.token || '') !== token) return res.status(401).json({ error: 'wrong token' })
  res.json({ ok: true })
})

app.get('/api/admin/launches', requireAdmin, (_req, res) => {
  res.json(allLaunches())
})

app.patch('/api/admin/launches/:id', requireAdmin, (req, res) => {
  const l = getLaunch(req.params.id)
  if (!l) return res.status(404).json({ error: 'not found' })
  const allowed = ['status', 'paused', 'forceRound', 'roundsDone', 'adminNotes', 'liveAt']
  const patch = { id: l.id }
  for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k]
  if (req.body?.recordDistribution) {
    patch.distributions = [...(l.distributions || []), req.body.recordDistribution]
    patch.forceRound = false
  }
  res.json(publicLaunch(upsertLaunch(patch)))
})

// ---- static frontend ---------------------------------------------------
const pub = path.join(PROJECT_ROOT, 'public')
app.use(express.static(pub, { extensions: ['html'] }))
app.get('/token/:addr', (_req, res) => res.sendFile(path.join(pub, 'token.html')))

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
  console.log(`robindrop up on http://localhost:${port}`)
  if (process.env.INDEXER !== 'false') startIndexer()
})
