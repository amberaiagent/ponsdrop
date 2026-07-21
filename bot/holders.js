// Holder snapshot via the Blockscout API, ranked by balance descending.
// The pool, locker, factory, vault and burn addresses never count as holders.
import { BLOCKSCOUT_API, ADDRESSES } from '../src/config.js'

const ZERO = '0x0000000000000000000000000000000000000000'

export async function snapshotHolders (token, { from, to, exclude = [] }) {
  const excluded = new Set([
    ADDRESSES.locker, ADDRESSES.factory, ADDRESSES.dead, ZERO, ...exclude,
  ].filter(Boolean).map(a => a.toLowerCase()))

  const holders = []
  let params = ''
  let pages = 0
  const need = to + excluded.size + 5

  while (holders.length < need && pages < 40) {
    const res = await fetch(`${BLOCKSCOUT_API}/tokens/${token}/holders${params}`, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`blockscout holders ${res.status}`)
    const j = await res.json()
    for (const item of j.items || []) {
      const addr = item.address?.hash
      if (!addr || excluded.has(addr.toLowerCase())) continue
      holders.push({ address: addr, value: BigInt(item.value || 0) })
    }
    if (!j.next_page_params) break
    params = '?' + new URLSearchParams(j.next_page_params).toString()
    pages++
  }

  holders.sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0))
  return holders.slice(from - 1, to).map(h => h.address)
}
