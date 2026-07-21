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

export async function airdropToken (wallet, token, recipients, totalAmount) {
  const empty = { txs: [], perWei: '0' }
  if (recipients.length === 0 || totalAmount === 0n) return empty
  const per = totalAmount / BigInt(recipients.length)
  if (per === 0n) return empty
  const txs = []
  for (const to of recipients) {
    const h = await send(wallet, `airdrop ${formatEther(per)} tokens -> ${to}`, () =>
      wallet.writeContract({ address: token, abi: ERC20_ABI, functionName: 'transfer', args: [to, per] }))
    if (h) txs.push(h)
  }
  return { txs, perWei: per.toString() }
}

// Percentage split to fixed recipients, for ETH and token balances.
export async function splitFunds (wallet, token, splits, ethWei, tokenAmount) {
  const txs = []
  for (const { address, pct } of splits) {
    const ethShare = (ethWei * BigInt(pct)) / 100n
    if (ethShare > 0n) {
      const h = await send(wallet, `split ${pct}% = ${formatEther(ethShare)} ETH -> ${address}`, () =>
        wallet.sendTransaction({ to: address, value: ethShare }))
      if (h) txs.push(h)
    }
    const tokShare = (tokenAmount * BigInt(pct)) / 100n
    if (tokShare > 0n) {
      const h = await send(wallet, `split ${pct}% tokens -> ${address}`, () =>
        wallet.writeContract({ address: token, abi: ERC20_ABI, functionName: 'transfer', args: [address, tokShare] }))
      if (h) txs.push(h)
    }
  }
  return txs
}

// Sell token-side fees into WETH on the launch pool. Used by the charity
// mode so the whole donation arrives as ETH instead of a random memecoin.
export async function sellTokenForWeth (wallet, token, amount) {
  if (amount === 0n) return
  await send(wallet, `approve router for ${formatEther(amount)} tokens`, () =>
    wallet.writeContract({ address: token, abi: ERC20_ABI, functionName: 'approve', args: [SWAP_ROUTER, amount] }))
  await send(wallet, `sell ${formatEther(amount)} tokens -> WETH`, () =>
    wallet.writeContract({
      address: SWAP_ROUTER,
      abi: ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: token,
        tokenOut: ADDRESSES.weth,
        fee: POOL_FEE,
        recipient: wallet.account.address,
        amountIn: amount,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      }],
    }))
}

export async function donateEth (wallet, to, amount) {
  if (amount === 0n) return null
  return send(wallet, `donate ${formatEther(amount)} ETH -> ${to}`, () =>
    wallet.sendTransaction({ to, value: amount }))
}

// Buyback and burn: token-side fees go straight to the dead address,
// WETH-side fees are swapped into the token on the launch pool, then burned.
export async function buybackAndBurn (wallet, token, wethAmount, tokenAmount) {
  const txs = []
  if (tokenAmount > 0n) {
    const h = await send(wallet, `burn ${formatEther(tokenAmount)} tokens`, () =>
      wallet.writeContract({ address: token, abi: ERC20_ABI, functionName: 'transfer', args: [ADDRESSES.dead, tokenAmount] }))
    if (h) txs.push(h)
  }
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
