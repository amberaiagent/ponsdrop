// Trust-minimized indexer: backfills TokenLaunched from the factory start
// block in bounded chunks (public RPC times out on wide eth_getLogs), then
// polls the tip. Links on-chain launches to our registry drafts by feeWallet
// (vault address) or by the tx hash reported from the launch page.
import { parseAbiItem } from 'viem'
import { publicClient, readErc20Meta, rememberPool } from './chain.js'
import { ADDRESSES, FACTORY_START_BLOCK } from './config.js'
import { allLaunches, upsertLaunch, getIndexerState, setIndexerState } from './store.js'

const EVENT = parseAbiItem('event TokenLaunched(address indexed token, address indexed deployer, address indexed dexFactory, address pairToken, address pool, uint256 dexId, uint256 launchConfigId, uint256 positionId, uint256 restrictionsEndBlock, uint256 initialBuyAmount)')

const CHUNK = 4000n
let running = false

export function startIndexer ({ intervalMs = 30_000 } = {}) {
  tick()
  setInterval(tick, intervalMs)
}

async function tick () {
  if (running) return
  running = true
  try {
    const tip = await publicClient.getBlockNumber()
    let cursor = BigInt(getIndexerState().cursor ?? FACTORY_START_BLOCK)
    // Bounded catch-up per tick so one slow RPC round never wedges the loop.
    let budget = 25
    while (cursor <= tip && budget-- > 0) {
      const to = cursor + CHUNK - 1n > tip ? tip : cursor + CHUNK - 1n
      const logs = await publicClient.getLogs({
        address: ADDRESSES.factory,
        event: EVENT,
        fromBlock: cursor,
        toBlock: to,
      })
      for (const log of logs) await ingest(log)
      cursor = to + 1n
      setIndexerState({ cursor: cursor.toString(), tip: tip.toString(), updatedAt: new Date().toISOString() })
    }
  } catch (e) {
    console.error('[indexer]', e.shortMessage || e.message)
  } finally {
    running = false
  }
}

async function ingest (log) {
  const { token, deployer, pool, positionId, initialBuyAmount } = log.args
  rememberPool(token, pool)

  // Already known by token address?
  const existing = allLaunches().find(l => l.token && l.token.toLowerCase() === token.toLowerCase())
  if (existing) {
    if (!existing.pool) upsertLaunch({ id: existing.id, pool, launchBlock: log.blockNumber.toString() })
    return
  }

  // A draft waiting for this launch? Match by tx hash first, then by feeWallet
  // once the locker exposes it (drafts store the vault address they handed out).
  const drafts = allLaunches().filter(l => l.status === 'draft' || l.status === 'pending')
  let draft = drafts.find(l => l.txHash && l.txHash.toLowerCase() === log.transactionHash.toLowerCase())
  if (!draft) {
    draft = drafts.find(l => l.feeWallet && l.deployer && l.deployer.toLowerCase() === deployer.toLowerCase())
  }

  const meta = await readErc20Meta(token)
  const base = {
    token,
    deployer,
    pool,
    positionId: positionId.toString(),
    initialBuyAmount: initialBuyAmount.toString(),
    launchBlock: log.blockNumber.toString(),
    txHash: log.transactionHash,
    name: meta.name,
    symbol: meta.symbol,
    status: 'live',
  }

  if (draft) {
    upsertLaunch({ ...base, id: draft.id, liveAt: new Date().toISOString(), name: draft.name || meta.name, symbol: draft.symbol || meta.symbol })
    console.log(`[indexer] linked launch ${draft.id} -> ${token} (${meta.symbol})`)
  } else {
    // Foreign launch (made outside robindrop): still listed on /explore.
    upsertLaunch({ ...base, id: `ext-${token.slice(2, 10)}`, feeMode: 'external', createdAt: new Date().toISOString() })
  }
}
