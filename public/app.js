// Shared frontend helpers: nav, toast, formatting, wallet connect.
export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

export function renderNav (active = '') {
  const el = document.getElementById('nav')
  if (!el) return
  const link = (href, key, label) =>
    `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`
  el.innerHTML = `
    <div class="navbar">
      <div class="inner">
        <a class="wordmark" href="/">
          <img class="nav-logo" src="/logo.png" alt="">
          robindrop
        </a>
        <div class="pillnav">
          ${link('/', 'home', 'Home')}
          ${link('/explore', 'explore', 'Explore')}
          ${link('/launch', 'launch', 'Launch')}
          ${link('/docs/', 'docs', 'Docs')}
        </div>
        <div class="nav-cta">
          <a class="btn small" href="/launch">Launch</a>
        </div>
      </div>
    </div>`
}

export function renderFooter () {
  const el = document.getElementById('footer')
  if (!el) return
  el.innerHTML = `
    <footer>
      <div class="wrap">
        <div class="cols">
          <div><strong style="color:var(--ink)">robindrop</strong><br>Launch on pons. Route the fees.</div>
          <div class="links">
            <a href="/launch">Launch</a>
            <a href="/explore">Explore</a>
            <a href="/docs/">Docs</a>
            <a href="https://ponsfamily.com" target="_blank" rel="noopener">pons</a>
            <a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noopener">Explorer</a>
          </div>
        </div>
        <div class="fine">
          Factory <span class="mono">0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB</span> · Locker <span class="mono">0x736D76699C26D0d966744cAe304C000d471f7F35</span><br>
          Unofficial layer on pons. Not affiliated with Pons Labs. Tokens are volatile; transactions may be irreversible. Nothing here is financial advice.
        </div>
      </div>
    </footer>`
}

// Scroll reveal: add .reveal (+ .d1/.d2/.d3 for stagger) to elements.
export function initReveal () {
  const els = $$('.reveal')
  // Anything already on screen shows immediately, no waiting on the observer.
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.top < innerHeight * 0.95 && r.bottom > 0) el.classList.add('in')
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
  }, { threshold: 0.12 })
  els.forEach(el => { if (!el.classList.contains('in')) io.observe(el) })
  // Last-resort: if the observer never fires (old browser, odd embed), show everything.
  setTimeout(() => els.forEach(el => el.classList.add('in')), 3000)
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

// Injected wallet only: no modal zoo.
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
