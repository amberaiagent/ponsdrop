// On-chain reads shared by the API server and the bot.
import { createPublicClient, http, formatEther, parseAbi } from 'viem'
import { CHAIN, ADDRESSES, FACTORY_ABI, LOCKER_ABI } from './config.js'

export const publicClient = createPublicClient({ chain: CHAIN, transport: http() })

export const factory = { address: ADDRESSES.factory, abi: FACTORY_ABI }
export const locker = { address: ADDRESSES.locker, abi: LOCKER_ABI }

export const ERC20_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
  'function approve(address, uint256) returns (bool)',
])

export const WETH_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function withdraw(uint256)',
  'function deposit() payable',
  'function approve(address, uint256) returns (bool)',
])

export const POOL_ABI = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
])

export const ROUTER_ABI = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
])

let cachedLaunchFee = null
export async function getLaunchFee () {
  if (cachedLaunchFee === null) {
    cachedLaunchFee = await publicClient.readContract({ ...factory, functionName: 'launchFee' })
  }
  return cachedLaunchFee
}

export async function readLaunchedToken (token) {
  const t = await publicClient.readContract({ ...factory, functionName: 'getLaunchedToken', args: [token] })
  return t?.exists ? t : null
}

export async function readGraduation (token) {
  const [pairedPrincipal, threshold, graduated] = await publicClient.readContract({
    ...factory, functionName: 'graduationStatus', args: [token],
  })
  return { pairedPrincipal, threshold, graduated }
}

export async function readFeeRedirect (token) {
  return publicClient.readContract({ ...locker, functionName: 'feeRedirects', args: [token] })
}

// ---- ETH/USD with a small cache (CoinGecko, no key) --------------------
let ethUsdCache = { value: null, at: 0 }
export async function ethUsd () {
  if (ethUsdCache.value && Date.now() - ethUsdCache.at < 5 * 60_000) return ethUsdCache.value
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', { signal: AbortSignal.timeout(8000) })
    const j = await res.json()
    const v = Number(j?.ethereum?.usd)
    if (v > 0) { ethUsdCache = { value: v, at: Date.now() }; return v }
  } catch { /* fall through */ }
  return ethUsdCache.value || Number(process.env.ETH_USD_FALLBACK || 3000)
}

// Token price in WETH from the pool spot price, then USD market cap.
export async function readMarketCapUsd (token, launched) {
  const info = launched || await readLaunchedToken(token)
  if (!info) return null
  const pool = await computePoolAddress(info)
  if (!pool) return null
  try {
    const [sqrtPriceX96] = await publicClient.readContract({ address: pool, abi: POOL_ABI, functionName: 'slot0' })
    const ratio = Number(sqrtPriceX96) / 2 ** 96
    // price of token0 in token1 units = ratio^2
    const p = ratio * ratio
    const priceInWeth = info.isToken0 ? p : 1 / p
    const supply = Number(formatEther(info.supply))
    const usd = await ethUsd()
    return { mcapUsd: priceInWeth * supply * usd, priceWeth: priceInWeth, ethUsd: usd, pool }
  } catch {
    return null
  }
}

// Pool address is emitted in TokenLaunched; when we only have the token we
// derive it from the position manager's factory pairing via the indexer
// registry. Callers should pass launch.pool when known.
const poolCache = new Map()
export async function computePoolAddress (info) {
  const k = info.token.toLowerCase()
  if (poolCache.has(k)) return poolCache.get(k)
  // The launch registry (indexer) stores pool addresses from the event; this
  // fallback asks Blockscout for the token's pools if we have nothing local.
  return null
}
export function rememberPool (token, pool) { poolCache.set(token.toLowerCase(), pool) }

export async function vaultBalances (vaultAddress, token) {
  const [eth, weth, tok] = await Promise.all([
    publicClient.getBalance({ address: vaultAddress }),
    publicClient.readContract({ address: ADDRESSES.weth, abi: WETH_ABI, functionName: 'balanceOf', args: [vaultAddress] }),
    token
      ? publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [vaultAddress] })
      : Promise.resolve(0n),
  ])
  return { eth, weth, token: tok }
}

// pons launch tokens expose logo() and description() even though the
// contracts are unverified; probed and confirmed on-chain.
const TOKEN_META_ABI = parseAbi([
  'function logo() view returns (string)',
  'function description() view returns (string)',
])
export async function readTokenBranding (token) {
  const out = { logo: null, description: null }
  try { out.logo = await publicClient.readContract({ address: token, abi: TOKEN_META_ABI, functionName: 'logo' }) } catch { /* not a pons token */ }
  try { out.description = await publicClient.readContract({ address: token, abi: TOKEN_META_ABI, functionName: 'description' }) } catch { /* ditto */ }
  return out
}

export async function readErc20Meta (token) {
  try {
    const [name, symbol] = await Promise.all([
      publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'name' }),
      publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'symbol' }),
    ])
    return { name, symbol }
  } catch {
    return { name: null, symbol: null }
  }
}
