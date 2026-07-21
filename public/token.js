import { renderNav, renderFooter, fmtUsd, fmtEth, short } from '/app.js'
renderNav('explore')
renderFooter()

const addr = location.pathname.split('/').pop()
const main = document.getElementById('main')
const MODES = { holders: 'Drop to holders', split: 'Split fees', burn: 'Buyback and burn', default: 'Dev keeps fees', external: 'Launched outside PonsDrop' }

async function render () {
  const data = await fetch('/api/token/' + addr).then(r => r.json())
  if (data.error) { main.innerHTML = `<div class="card"><h2>Not found</h2><p class="hint">${data.error}</p></div>`; return }
  const l = data.launch || {}
  const oc = data.onchain
  const token = l.token || addr
  const explorer = 'https://robinhoodchain.blockscout.com'

  const grad = oc ? Math.min(100, (Number(oc.pairedPrincipalEth) / Number(oc.graduationThresholdEth)) * 100) : 0

  let scheduleHtml = ''
  if (data.schedule) {
    const done = l.roundsDone || 0
    scheduleHtml = `
      <div class="card">
        <h2>Drop schedule</h2>
        <p style="color:var(--muted);margin-top:-6px">Holders #${l.dropConfig.holderFrom} to #${l.dropConfig.holderTo}. Each round sends its % of whatever the fee vault holds when it fires. After the last round the vault flushes 100% at the same pace.</p>
        <table>
          <tr><th>Round</th><th>Trigger</th><th>% of vault</th><th>Status</th></tr>
          ${data.schedule.map((r, i) => `
            <tr>
              <td class="mono">${r.round}</td>
              <td class="mono">${r.capUsd !== undefined ? fmtUsd(r.capUsd) + ' cap' : r.afterHours + 'h after launch'}</td>
              <td class="mono">${r.pct}%</td>
              <td>${i < done ? '<span class="badge live">done</span>' : (i === done ? '<span class="badge gold">next</span>' : '<span class="badge">queued</span>')}</td>
            </tr>`).join('')}
        </table>
      </div>`
  }

  let distHtml = ''
  if (l.distributions?.length) {
    distHtml = `
      <div class="card">
        <h2>Payout history</h2>
        <table>
          <tr><th>When</th><th>What</th><th>ETH</th><th>Txs</th></tr>
          ${l.distributions.map(d => `
            <tr>
              <td class="mono">${(d.at || '').slice(0, 16).replace('T', ' ')}</td>
              <td>${d.round ? 'Round ' + d.round + ' to ' + d.holders + ' holders' : (d.kind || '')}</td>
              <td class="mono">${d.ethWei ? fmtEth(Number(d.ethWei) / 1e18) : (d.wethWei ? fmtEth(Number(d.wethWei) / 1e18) : '')}</td>
              <td class="mono">${d.txCount ?? ''}</td>
            </tr>`).join('')}
        </table>
      </div>`
  }

  let vaultHtml = ''
  if (data.vault) {
    vaultHtml = `
      <div class="card tint">
        <h3>Fee vault</h3>
        <div class="statgrid">
          <div class="stat"><div class="k">ETH</div><div class="v">${fmtEth(data.vault.eth)}</div></div>
          <div class="stat"><div class="k">WETH</div><div class="v">${fmtEth(data.vault.weth)}</div></div>
          <div class="stat"><div class="k">${l.symbol || 'Token'}</div><div class="v">${fmtEth(data.vault.token, 0)}</div></div>
        </div>
        <p class="hint" style="margin-bottom:0">Vault <a class="mono" href="${explorer}/address/${data.vault.address}" target="_blank" rel="noopener">${data.vault.address}</a>. Every payout is a plain transfer you can audit.</p>
      </div>`
  }

  main.innerHTML = `
    <div class="hero" style="padding:20px 0 26px">
      <div class="chip">${MODES[l.feeMode] || 'token'}</div>
      <h1 style="font-size:clamp(2rem,4.5vw,3rem)">${esc(l.symbol) || short(token)} <span class="dim" style="font-size:.5em">${esc(l.name) || ''}</span></h1>
      <p class="lead mono" style="font-size:.85rem;word-break:break-all">${token}
        <button class="btn secondary small" id="copy" style="margin-left:8px">copy</button>
        <a class="btn secondary small" href="${explorer}/token/${token}" target="_blank" rel="noopener">explorer</a>
      </p>
    </div>
    <div class="card">
      <div class="statgrid">
        <div class="stat"><div class="k">Market cap</div><div class="v">${oc?.mcapUsd ? fmtUsd(oc.mcapUsd) : '?'}</div></div>
        <div class="stat"><div class="k">Graduation</div><div class="v">${oc ? fmtEth(oc.pairedPrincipalEth, 2) + ' / ' + fmtEth(oc.graduationThresholdEth, 1) + ' ETH' : '?'}</div></div>
        <div class="stat"><div class="k">Status</div><div class="v">${oc?.graduated ? 'graduated' : Math.round(grad) + '%'}</div></div>
        <div class="stat"><div class="k">Fee route</div><div class="v" style="font-size:.9rem">${MODES[l.feeMode] || '?'}</div></div>
      </div>
      ${data.onchainError ? `<p class="hint" style="margin-top:10px">On-chain read failed: ${esc(data.onchainError)}</p>` : ''}
    </div>
    ${vaultHtml}
    ${scheduleHtml}
    ${distHtml}
  `
  document.getElementById('copy')?.addEventListener('click', () => navigator.clipboard.writeText(token))
}

function esc (s) { return s ? String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])) : s }

await render()
setInterval(render, 15_000)
