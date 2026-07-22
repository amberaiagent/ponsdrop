// robindrop distribution bot.
// Reads launches from the site API, signs from local encrypted vault keys,
// reports rounds back through the admin API. DRY_RUN=true by default: it
// logs every action it would take and touches nothing on-chain.
import '../src/load-env.js'
import { createWalletClient, http, formatEther, parseEther } from 'viem'
import { CHAIN, ADDRESSES } from '../src/config.js'
import { publicClient, locker, vaultBalances, readMarketCapUsd, rememberPool } from '../src/chain.js'
import { vaultAccount } from '../src/vault.js'
import { snapshotHolders } from './holders.js'
import { DRY_RUN, unwrapWeth, distributableEth, airdropEth, splitFunds, buybackAndBurn, donateEth } from './distribute.js'

// PonsDrop only ever distributes the ETH-denominated creator fees. The
// token-side fees that also accrue in the vault are left untouched: we never
// sell, transfer or burn the launch token, so a managed launch never puts
// sell pressure on its own pool. Token-side fees simply rest in the vault.
import { nextRound } from '../src/schedule.js'

const SITE = process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''
const POLL_MS = Number(process.env.BOT_POLL_SECONDS || 60) * 1000
const MIN_DISTRIBUTE = parseEther(process.env.MIN_DISTRIBUTE_ETH || '0.001')

console.log(`robindrop bot | DRY_RUN=${DRY_RUN} | site=${SITE} | poll=${POLL_MS / 1000}s`)
if (DRY_RUN) console.log('>> no transactions will be sent. Set DRY_RUN=false in .env to go live. <<')

async function api (path, opts = {}) {
  const res = await fetch(SITE + path, {
    ...opts,
    headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN, ...opts.headers },
  })
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`)
  return res.json()
}

function walletFor (vaultAddress) {
  const account = vaultAccount(vaultAddress)
  if (!account) return null
  return createWalletClient({ account, chain: CHAIN, transport: http() })
}

async function collectFees (wallet, token) {
  try {
    if (DRY_RUN) {
      const { result } = await publicClient.simulateContract({
        ...locker, functionName: 'collectFees', args: [token], account: wallet.account,
      })
      console.log(`[dry-run] collectFees(${token}) would yield`, result?.map(x => x.toString()))
      return
    }
    const hash = await wallet.writeContract({ ...locker, functionName: 'collectFees', args: [token] })
    await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
    console.log(`[tx] collectFees(${token}) -> ${hash}`)
  } catch (e) {
    // Nothing to collect, or the vault lacks gas yet. Both are routine.
    console.log(`[collect] ${token}: ${e.shortMessage || e.message}`)
  }
}

async function processHolders (l, wallet) {
  const cfg = l.dropConfig
  const next = nextRound(cfg, l.roundsDone || 0)

  let triggered = Boolean(l.forceRound)
  let capNow = null
  if (!triggered && cfg.trigger === 'mcap') {
    const m = await readMarketCapUsd(l.token)
    capNow = m?.mcapUsd ?? null
    triggered = capNow !== null && capNow >= next.capUsd
    console.log(`[${l.symbol || l.id}] mcap $${fmt(capNow)} vs round ${next.round} target $${fmt(next.capUsd)}${triggered ? ' TRIGGERED' : ''}`)
  } else if (!triggered && cfg.trigger === 'interval') {
    const since = Date.parse(l.liveAt || l.createdAt)
    const hours = (Date.now() - since) / 3_600_000
    triggered = hours >= next.afterHours
    console.log(`[${l.symbol || l.id}] ${hours.toFixed(1)}h elapsed vs round ${next.round} at ${next.afterHours}h${triggered ? ' TRIGGERED' : ''}`)
  }
  if (!triggered) return

  const b = await vaultBalances(l.feeWallet, l.token)
  await unwrapWeth(wallet, b.weth)
  const ethAll = distributableEth(DRY_RUN ? b.eth + b.weth : (await vaultBalances(l.feeWallet, l.token)).eth)
  const ethShare = (ethAll * BigInt(next.pct)) / 100n
  if (ethShare < MIN_DISTRIBUTE) {
    console.log(`[${l.symbol || l.id}] round ${next.round} due but vault too thin (${formatEther(ethShare)} ETH), waiting`)
    return
  }

  const holders = await snapshotHolders(l.token, {
    from: cfg.holderFrom,
    to: cfg.holderTo,
    exclude: [l.pool, l.feeWallet, l.deployer],
  })
  if (holders.length === 0) { console.log(`[${l.symbol || l.id}] no holders in range, skipping`); return }

  console.log(`[${l.symbol || l.id}] round ${next.round}: ${formatEther(ethShare)} ETH -> ${holders.length} holders (#${cfg.holderFrom}-#${cfg.holderTo})`)
  const ethRes = await airdropEth(wallet, holders, ethShare)

  if (!DRY_RUN) {
    await api(`/api/admin/launches/${l.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        roundsDone: (l.roundsDone || 0) + 1,
        forceRound: false,
        recordDistribution: {
          round: next.round,
          at: new Date().toISOString(),
          trigger: cfg.trigger === 'mcap' ? { capUsd: next.capUsd, capNow } : { afterHours: next.afterHours },
          holders: holders.length,
          ethWei: ethShare.toString(),
          perHolderEthWei: ethRes.perWei || '0',
          txCount: ethRes.txs?.length || 0,
        },
      }),
    })
  }
}

async function processSplit (l, wallet) {
  const b = await vaultBalances(l.feeWallet, l.token)
  await unwrapWeth(wallet, b.weth)
  const eth = distributableEth(DRY_RUN ? b.eth + b.weth : (await vaultBalances(l.feeWallet, l.token)).eth)
  if (eth < MIN_DISTRIBUTE) return
  console.log(`[${l.symbol || l.id}] split: ${formatEther(eth)} ETH across ${l.splitConfig.length} wallets`)
  const txs = await splitFunds(wallet, l.splitConfig, eth)
  if (!DRY_RUN && txs.length) {
    await api(`/api/admin/launches/${l.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        recordDistribution: { at: new Date().toISOString(), kind: 'split', ethWei: eth.toString(), txCount: txs.length },
      }),
    })
  }
}

async function processBurn (l, wallet) {
  // Buyback and burn uses only the ETH-side fees to market-buy the token and
  // send what it buys to the dead address. The token-side fees in the vault
  // are left where they are; we never move the launch supply directly.
  const b = await vaultBalances(l.feeWallet, l.token)
  if (b.weth < MIN_DISTRIBUTE) return
  console.log(`[${l.symbol || l.id}] buyback and burn: ${formatEther(b.weth)} WETH`)
  const txs = await buybackAndBurn(wallet, l.token, b.weth)
  if (!DRY_RUN && txs.length) {
    await api(`/api/admin/launches/${l.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        recordDistribution: { at: new Date().toISOString(), kind: 'burn', wethWei: b.weth.toString(), txCount: txs.length },
      }),
    })
  }
}

async function processCharity (l, wallet) {
  const to = l.charityConfig?.address
  if (!to) { console.error(`[${l.symbol || l.id}] charity mode without an address, skipping`); return }
  const b = await vaultBalances(l.feeWallet, l.token)
  await unwrapWeth(wallet, b.weth)
  const eth = distributableEth(DRY_RUN ? b.eth + b.weth : (await vaultBalances(l.feeWallet, l.token)).eth)
  if (eth < MIN_DISTRIBUTE) return
  console.log(`[${l.symbol || l.id}] donating ${formatEther(eth)} ETH to ${l.charityConfig.name} (${to})`)
  const tx = await donateEth(wallet, to, eth)
  if (!DRY_RUN && tx) {
    await api(`/api/admin/launches/${l.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        recordDistribution: { at: new Date().toISOString(), kind: 'charity', charity: l.charityConfig.name, to, ethWei: eth.toString(), txCount: 1 },
      }),
    })
  }
}

async function tick () {
  let launches
  try {
    launches = await api('/api/launches', { headers: {} })
  } catch (e) {
    console.error('[bot] site unreachable:', e.message)
    return
  }
  for (const l of launches) {
    if (l.status !== 'live' || l.paused) continue
    if (!['holders', 'split', 'burn', 'charity'].includes(l.feeMode)) continue
    if (!l.token || !l.feeWallet) continue
    const wallet = walletFor(l.feeWallet)
    if (!wallet) { console.error(`[bot] no vault key for ${l.feeWallet} (${l.id})`); continue }
    if (l.pool) rememberPool(l.token, l.pool)
    try {
      await collectFees(wallet, l.token)
      if (l.feeMode === 'holders') await processHolders(l, wallet)
      else if (l.feeMode === 'split') await processSplit(l, wallet)
      else if (l.feeMode === 'burn') await processBurn(l, wallet)
      else if (l.feeMode === 'charity') await processCharity(l, wallet)
    } catch (e) {
      console.error(`[bot] ${l.id}:`, e.shortMessage || e.message)
    }
  }
}

function fmt (n) { return n === null || n === undefined ? '?' : Math.round(n).toLocaleString('en-US') }

await tick()
setInterval(tick, POLL_MS)
