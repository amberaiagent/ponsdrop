// Shared frontend helpers: nav, toast, formatting, wallet connect.
export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

export function renderNav (active = '') {
  const el = document.getElementById('nav')
  if (!el) return
  el.innerHTML = `
    <nav class="wrap">
      <a class="wordmark" href="/">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <path d="M13 2C13 2 5 10.5 5 16a8 8 0 0 0 16 0C21 10.5 13 2 13 2Z" fill="#f59e0b"/>
          <path d="M13 7.5c0 0-4.4 4.9-4.4 8.1a4.4 4.4 0 0 0 8.8 0C17.4 12.4 13 7.5 13 7.5Z" fill="#0c3b1f"/>
        </svg>
        robindrop
      </a>
      <div class="navlinks">
        <a href="/explore" ${active === 'explore' ? 'style="background:rgba(255,255,255,.12)"' : ''}>Explore</a>
        <a href="/docs" ${active === 'docs' ? 'style="background:rgba(255,255,255,.12)"' : ''}>Docs</a>
        <a class="cta" href="/launch">Launch</a>
      </div>
    </nav>`
}

let toastTimer
export function toast (msg, ms = 3200) {
  let el = $('.toast')
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el) }
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), ms)
}

export const short = (a) => a ? a.slice(0, 6) + '...' + a.slice(-4) : ''
export const fmtUsd = (n) => n === null || n === undefined ? '?' : '$' + Math.round(n).toLocaleString('en-US')
export const fmtEth = (n, d = 4) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d })

export async function getConfig () {
  const res = await fetch('/api/config')
  return res.json()
}

// Injected wallet only, trench style: no modal zoo.
export async function connectWallet (cfg) {
  if (!window.ethereum) throw new Error('No wallet found. Install MetaMask or Rabby.')
  const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })
  const hexId = '0x' + cfg.chain.id.toString(16)
  const current = await window.ethereum.request({ method: 'eth_chainId' })
  if (current !== hexId) {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] })
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: hexId,
            chainName: cfg.chain.name,
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [cfg.chain.rpc],
            blockExplorerUrls: [cfg.chain.explorer],
          }],
        })
      } else throw e
    }
  }
  return account
}
