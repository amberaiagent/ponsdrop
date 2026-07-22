import { $, $$, renderNav, renderFooter, initNavWallet, setNavAccount, toast, getConfig, connectWallet, fmtUsd } from '/app.js'
import {
  createWalletClient, createPublicClient, custom, http, parseEther, decodeEventLog, parseAbiItem,
} from 'https://esm.sh/viem@2.55.4'

renderNav('launch')
renderFooter()

const cfg = await getConfig()
$('#s-fee').textContent = cfg.launchFeeEth ? cfg.launchFeeEth + ' ETH' : '0.0005 ETH'

const chain = {
  id: cfg.chain.id,
  name: cfg.chain.name,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [cfg.chain.rpc] } },
}

const LAUNCH_ABI = [{
  type: 'function',
  name: 'launchToken',
  stateMutability: 'payable',
  inputs: [{
    name: 'params',
    type: 'tuple',
    components: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'logo', type: 'string' },
      { name: 'description', type: 'string' },
      {
        name: 'socials',
        type: 'tuple',
        components: [
          { name: 'twitter', type: 'string' },
          { name: 'telegram', type: 'string' },
          { name: 'discord', type: 'string' },
          { name: 'website', type: 'string' },
          { name: 'farcaster', type: 'string' },
        ],
      },
      { name: 'feeWallet', type: 'address' },
    ],
  }, { name: 'launchConfigId', type: 'uint256' }, { name: 'dexId', type: 'uint256' }, { name: 'salt', type: 'bytes32' }],
  outputs: [{ name: 'token', type: 'address' }],
}]

const TOKEN_LAUNCHED = parseAbiItem('event TokenLaunched(address indexed token, address indexed deployer, address indexed dexFactory, address pairToken, address pool, uint256 dexId, uint256 launchConfigId, uint256 positionId, uint256 restrictionsEndBlock, uint256 initialBuyAmount)')

// ---- prefill from the landing quick-start card -------------------------
{
  const q = new URLSearchParams(location.search)
  if (q.get('name')) $('#f-name').value = q.get('name')
  if (q.get('symbol')) $('#f-symbol').value = q.get('symbol')
  if (q.get('desc')) $('#f-desc').value = q.get('desc')
}

// ---- logo upload: crop to 1:1, cap at 500px, send to the server --------
$('#logo-pick').addEventListener('click', () => $('#f-logo-file').click())
$('#f-logo-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file) return
  const status = $('#logo-status')
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Cannot read that image'))
      i.src = URL.createObjectURL(file)
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    if (side < 250) throw new Error(`Too small: ${img.naturalWidth}×${img.naturalHeight}. Minimum is 250×250.`)
    const out = Math.min(500, side)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = out
    const sx = (img.naturalWidth - side) / 2
    const sy = (img.naturalHeight - side) / 2
    canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, out, out)
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))

    status.textContent = 'Uploading...'
    const res = await fetch('/api/upload/logo', { method: 'POST', headers: { 'content-type': 'image/png' }, body: blob })
    const j = await res.json()
    if (!res.ok || !j.url) throw new Error(j.error || 'Upload failed')
    $('#f-logo').value = j.url
    $('#logo-preview').src = canvas.toDataURL('image/png')
    $('#logo-preview').hidden = false
    status.textContent = j.via === 'pons' ? `Uploaded to IPFS, ${out}×${out}` : `Uploaded, ${out}×${out}`
  } catch (err) {
    status.textContent = err.message
    toast(err.message)
  } finally {
    e.target.value = ''
  }
})
// ---- fee mode selection ------------------------------------------------
let mode = 'default'
$$('#modes .mode').forEach(el => el.addEventListener('click', () => {
  mode = el.dataset.mode
  $$('#modes .mode').forEach(m => m.classList.toggle('active', m === el))
  $('#panel-holders').hidden = mode !== 'holders'
  $('#panel-split').hidden = mode !== 'split'
  $('#panel-burn').hidden = mode !== 'burn'
  $('#panel-charity').hidden = mode !== 'charity'
  syncDevBuy()
  if (mode === 'holders') drawPreview()
}))

// pons routes the initial buy to feeWallet. For managed modes feeWallet is the
// vault, so a dev buy would go to the vault instead of the dev. Disable it and
// explain; devs buy from their own wallet after launch.
function syncDevBuy () {
  const input = $('#f-devbuy')
  const note = $('#devbuy-note')
  const managed = mode !== 'default'
  input.disabled = managed
  if (managed) input.value = ''
  input.style.opacity = managed ? '0.5' : '1'
  if (note) note.textContent = managed
    ? 'Disabled for this fee mode: pons sends the dev buy to the fee vault, not to you. Buy from your own wallet right after launch instead.'
    : 'Sent on top of the launch fee. Max wallet is 5% of supply.'
}
syncDevBuy()

// ---- charity picker ----------------------------------------------------
let charityId = null
{
  const list = $('#charity-list')
  list.innerHTML = (cfg.charities || []).map(c => `
    <label class="mode" style="display:flex;gap:12px;align-items:flex-start;cursor:pointer">
      <input type="radio" name="charity" value="${c.id}" style="width:auto;margin-top:12px">
      ${c.logo ? `<img src="${c.logo}" alt="" style="width:40px;height:40px;border-radius:10px;object-fit:contain;background:#fff;border:1px solid var(--line-soft);flex:none;margin-top:2px">` : ''}
      <span style="min-width:0">
        <span style="font-weight:600;display:block">${c.name}</span>
        <span class="d" style="display:block">${c.blurb}</span>
        <span class="hint mono" style="word-break:break-all">${c.address}</span>
        <a class="hint" href="${c.source}" target="_blank" rel="noopener">address source</a>
      </span>
    </label>`).join('')
  list.addEventListener('change', (e) => { charityId = e.target.value })
}

function charityConfig () {
  return { charityId }
}

// ---- holders config ----------------------------------------------------
const PRESETS = {
  halving: { rounds: 10, pct: 50, trigger: 'mcap', capmode: 'multiply', capval: 2 },
  fullsend: { rounds: 10, pct: 100, trigger: 'mcap', capmode: 'multiply', capval: 2 },
  drip: { rounds: 14, pct: 20, trigger: 'interval', hours: 12 },
}
$$('#presets .chip').forEach(ch => ch.addEventListener('click', (e) => {
  e.preventDefault()
  const p = PRESETS[ch.dataset.preset]
  $$('#presets .chip').forEach(c => c.classList.toggle('active', c === ch))
  $('#d-rounds').value = p.rounds
  $('#d-pct').value = p.pct
  $('#d-trigger').value = p.trigger
  if (p.capmode) $('#d-capmode').value = p.capmode
  if (p.capval) $('#d-capval').value = p.capval
  if (p.hours) $('#d-hours').value = p.hours
  syncTriggerFields()
  drawPreview()
}))

function syncTriggerFields () {
  const t = $('#d-trigger').value
  $('#mcap-fields').hidden = t !== 'mcap'
  $('#interval-fields').hidden = t !== 'interval'
  $('#d-capval-label').textContent = $('#d-capmode').value === 'step' ? 'Step ($)' : 'Factor'
}
;['d-trigger', 'd-capmode'].forEach(id => $('#' + id).addEventListener('change', () => { syncTriggerFields(); drawPreview() }))
;['d-from', 'd-to', 'd-rounds', 'd-pct', 'd-start', 'd-capval', 'd-hours'].forEach(id =>
  $('#' + id).addEventListener('input', drawPreview))

function dropConfig () {
  const capmode = $('#d-capmode').value
  return {
    holderFrom: Number($('#d-from').value || 1),
    holderTo: Number($('#d-to').value || 200),
    rounds: Number($('#d-rounds').value || 2),
    pctPerRound: Number($('#d-pct').value || 50),
    trigger: $('#d-trigger').value,
    intervalHours: Number($('#d-hours').value || 24),
    capMode: capmode,
    capFactor: capmode === 'multiply' ? Number($('#d-capval').value || 2) : 2,
    capStepUsd: capmode === 'step' ? Number($('#d-capval').value || 0) : 0,
    startCapUsd: Number($('#d-start').value || 0),
  }
}

// Mirror of the server schedule math, for the live infographic.
function drawPreview () {
  const c = dropConfig()
  const bars = $('#bars'); const labels = $('#barlabels')
  bars.innerHTML = ''; labels.innerHTML = ''
  const n = Math.min(30, Math.max(1, c.rounds))
  let remaining = 100
  for (let i = 0; i < n; i++) {
    const share = remaining * (c.pctPerRound / 100)
    remaining -= share
    const bar = document.createElement('div')
    bar.className = 'bar'
    bar.style.height = Math.max(6, share) + '%'
    bar.innerHTML = `<span>${share.toFixed(share < 10 ? 1 : 0)}%</span>`
    bars.appendChild(bar)
    const lab = document.createElement('div')
    if (c.trigger === 'interval') lab.textContent = `${c.intervalHours * (i + 1)}h`
    else {
      const cap = c.capMode === 'multiply' ? c.startCapUsd * Math.pow(c.capFactor, i) : c.startCapUsd + c.capStepUsd * i
      lab.textContent = cap >= 1e6 ? '$' + (cap / 1e6).toFixed(1) + 'M' : '$' + Math.round(cap / 1000) + 'k'
    }
    labels.appendChild(lab)
  }
}
syncTriggerFields()
drawPreview()

// ---- split config ------------------------------------------------------
function addSplitRow (address = '', pct = '') {
  const row = document.createElement('div')
  row.className = 'row'
  row.style.gridTemplateColumns = '3fr 1fr auto'
  row.innerHTML = `
    <div class="field" style="margin-bottom:8px"><input class="mono s-addr" placeholder="0x..." value="${address}"></div>
    <div class="field" style="margin-bottom:8px"><input class="mono s-pct" type="number" min="1" max="100" placeholder="%" value="${pct}"></div>
    <button class="btn ghost small s-del" style="height:44px">x</button>`
  row.querySelector('.s-del').addEventListener('click', (e) => { e.preventDefault(); row.remove() })
  $('#splits').appendChild(row)
}
$('#add-split').addEventListener('click', (e) => { e.preventDefault(); addSplitRow() })
addSplitRow('', 50)
addSplitRow('', 50)

function splitConfig () {
  return $$('#splits .row').map(r => ({
    address: r.querySelector('.s-addr').value.trim(),
    pct: Number(r.querySelector('.s-pct').value),
  })).filter(s => s.address || s.pct)
}

// ---- wallet + launch ---------------------------------------------------
let account = null
function setAccount (acc) {
  account = acc || null
  $('#connect').textContent = account ? account.slice(0, 6) + '...' + account.slice(-4) : 'Connect wallet'
  $('#launch').disabled = !account
}
initNavWallet(setAccount)
$('#connect').addEventListener('click', async () => {
  try {
    setAccount(await connectWallet(cfg))
    setNavAccount(account)
    toast('Wallet connected')
  } catch (e) { toast(e.shortMessage || e.message) }
})

$('#launch').addEventListener('click', async () => {
  const status = $('#status')
  try {
    const name = $('#f-name').value.trim()
    const symbol = $('#f-symbol').value.trim().toUpperCase()
    if (!name || !symbol) return toast('Name and ticker are required')
    if (mode === 'holders') {
      const c = dropConfig()
      if (c.trigger === 'mcap' && !(c.startCapUsd > 0)) return toast('Set the first round market cap')
    }
    if (mode === 'charity' && !charityId) return toast('Pick a charity from the list')

    $('#launch').disabled = true
    status.textContent = 'Preparing fee vault...'
    const prep = await fetch('/api/launch/prepare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        feeMode: mode,
        name, symbol,
        deployer: account,
        dropConfig: mode === 'holders' ? dropConfig() : undefined,
        splitConfig: mode === 'split' ? splitConfig() : undefined,
        charityConfig: mode === 'charity' ? charityConfig() : undefined,
      }),
    }).then(r => r.json())
    if (prep.error) throw new Error(prep.error)
    const feeWallet = prep.feeWallet || account

    const params = {
      name,
      symbol,
      logo: $('#f-logo').value.trim(),
      description: $('#f-desc').value.trim(),
      socials: {
        twitter: $('#f-tw').value.trim(),
        telegram: $('#f-tg').value.trim(),
        discord: '',
        website: $('#f-web').value.trim(),
        farcaster: '',
      },
      feeWallet,
    }
    const salt = '0x' + [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('')
    // pons sends the initial buy to feeWallet. In managed modes that is the
    // vault, so a dev buy would land in the vault, not with the dev. We force
    // it off here; the dev buys from their own wallet after launch instead.
    const devBuy = mode === 'default' ? Number($('#f-devbuy').value || 0) : 0
    const value = parseEther(cfg.launchFeeEth || '0.0005') + parseEther(String(devBuy || 0))

    status.textContent = 'Confirm in your wallet...'
    const wallet = createWalletClient({ account, chain, transport: custom(window.ethereum) })
    const pub = createPublicClient({ chain, transport: http(cfg.chain.rpc) })
    const hash = await wallet.writeContract({
      address: cfg.factory,
      abi: LAUNCH_ABI,
      functionName: 'launchToken',
      args: [params, BigInt(cfg.launchConfigId), BigInt(cfg.dexId), salt],
      value,
    })

    status.textContent = 'Waiting for confirmation...'
    await fetch('/api/launch/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draftId: prep.draftId, txHash: hash, deployer: account, name, symbol, logo: params.logo }),
    })

    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 })
    let token = null
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({ abi: [TOKEN_LAUNCHED], data: log.data, topics: log.topics })
        if (ev.eventName === 'TokenLaunched') { token = ev.args.token; break }
      } catch { /* not our event */ }
    }
    if (token) {
      await fetch('/api/launch/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draftId: prep.draftId, txHash: hash, token, deployer: account }),
      })
      status.textContent = 'Launched!'
      toast('Token launched: ' + token)
      location.href = '/token/' + token
    } else {
      status.textContent = 'Launched, waiting for the indexer to pick it up.'
      location.href = '/explore'
    }
  } catch (e) {
    console.error(e)
    status.textContent = ''
    toast(e.shortMessage || e.message || 'Launch failed')
    $('#launch').disabled = false
  }
})
