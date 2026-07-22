// Distribution engines. Every write goes through send() which honors DRY_RUN.
import { formatEther } from 'viem'
import { publicClient, ERC20_ABI, WETH_ABI, ROUTER_ABI } from '../src/chain.js'
import { ADDRESSES } from '../src/config.js'

export const DRY_RUN = process.env.DRY_RUN !== 'false'
const GAS_RESERVE = BigInt(process.env.GAS_RESERVE_WEI || 200_000_000_000_000n) // 0.0002 ETH kept for gas
const SWAP_ROUTER = '0xCaf681a66D020601342297493863E78C959E5cb2'
const POOL_FEE = 10000

async function send (wallet, description, fn) {
  if (DRY_RUN) {
    console.log(`[dry-run] ${description}`)
    return null
  }
  const hash = await fn()
  console.log(`[tx] ${description} -> ${hash}`)
  await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
  return hash
}

export async function unwrapWeth (wallet, amount) {
  if (amount === 0n) return
  await send(wallet, `unwrap ${formatEther(amount)} WETH`, () =>
    wallet.writeContract({ address: ADDRESSES.weth, abi: WETH_ABI, functionName: 'withdraw', args: [amount] }))
}

export function distributableEth (balance) {
  return balance > GAS_RESERVE ? balance - GAS_RESERVE : 0n
}

// Even ETH airdrop to a holder list. Returns tx hashes.
export async function airdropEth (wallet, recipients, totalWei) {
  const empty = { txs: [], perWei: '0' }
  if (recipients.length === 0 || totalWei === 0n) return empty
  const per = totalWei / BigInt(recipients.length)
  if (per === 0n) return empty
  const txs = []
  for (const to of recipients) {
    const h = await send(wallet, `airdrop ${formatEther(per)} ETH -> ${to}`, () =>
      wallet.sendTransaction({ to, value: per }))
    if (h) txs.push(h)
  }
  return { txs, perWei: per.toString() }
}

// Percentage split of the ETH fees to fixed recipients. Token-side fees are
// never touched, so a split launch never sells its own supply.
export async function splitFunds (wallet, splits, ethWei) {
  const txs = []
  for (const { address, pct } of splits) {
    const ethShare = (ethWei * BigInt(pct)) / 100n
    if (ethShare > 0n) {
      const h = await send(wallet, `split ${pct}% = ${formatEther(ethShare)} ETH -> ${address}`, () =>
        wallet.sendTransaction({ to: address, value: ethShare }))
      if (h) txs.push(h)
    }
  }
  return txs
}

export async function donateEth (wallet, to, amount) {
  if (amount === 0n) return null
  return send(wallet, `donate ${formatEther(amount)} ETH -> ${to}`, () =>
    wallet.sendTransaction({ to, value: amount }))
}

// Buyback and burn: WETH-side fees are swapped into the token on the launch
// pool and the bought tokens go straight to the dead address. The token-side
// fees already in the vault are left untouched.
export async function buybackAndBurn (wallet, token, wethAmount) {
  const txs = []
  if (wethAmount > 0n) {
    await send(wallet, `approve router for ${formatEther(wethAmount)} WETH`, () =>
      wallet.writeContract({ address: ADDRESSES.weth, abi: WETH_ABI, functionName: 'approve', args: [SWAP_ROUTER, wethAmount] }))
    const h = await send(wallet, `buyback ${formatEther(wethAmount)} WETH -> token, burn`, () =>
      wallet.writeContract({
        address: SWAP_ROUTER,
        abi: ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn: ADDRESSES.weth,
          tokenOut: token,
          fee: POOL_FEE,
          recipient: ADDRESSES.dead,
          amountIn: wethAmount,
          amountOutMinimum: 0n,
          sqrtPriceLimitX96: 0n,
        }],
      }))
    if (h) txs.push(h)
  }
  return txs
}
