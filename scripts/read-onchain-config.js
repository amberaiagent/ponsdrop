// One-off: read live launch configs from the pons factory so we know
// launchFee, launchConfigId/dexId to use, restrictions and the graduation threshold.
import { createPublicClient, http, formatEther } from 'viem'
import { CHAIN, ADDRESSES, FACTORY_ABI, LOCKER_ABI } from '../src/config.js'

const client = createPublicClient({ chain: CHAIN, transport: http() })
const factory = { address: ADDRESSES.factory, abi: FACTORY_ABI }
const locker = { address: ADDRESSES.locker, abi: LOCKER_ABI }

const [launchFee, launchEnabled, launchConfigCount, dexConfigCount, protocolFeeShare, feeRecipient] = await Promise.all([
  client.readContract({ ...factory, functionName: 'launchFee' }),
  client.readContract({ ...factory, functionName: 'launchEnabled' }),
  client.readContract({ ...factory, functionName: 'launchConfigCount' }),
  client.readContract({ ...factory, functionName: 'dexConfigCount' }),
  client.readContract({ ...locker, functionName: 'protocolFeeShare' }),
  client.readContract({ ...locker, functionName: 'protocolFeeRecipient' }),
])

console.log('launchFee:', formatEther(launchFee), 'ETH')
console.log('launchEnabled:', launchEnabled)
console.log('launchConfigCount:', launchConfigCount.toString())
console.log('dexConfigCount:', dexConfigCount.toString())
console.log('locker protocolFeeShare:', protocolFeeShare.toString())
console.log('locker protocolFeeRecipient:', feeRecipient)

for (let i = 0n; i < launchConfigCount; i++) {
  const c = await client.readContract({ ...factory, functionName: 'getLaunchConfig', args: [i] })
  console.log(`launchConfig[${i}]:`, JSON.stringify(c, (_, v) => typeof v === 'bigint' ? v.toString() : v))
}
for (let i = 0n; i < dexConfigCount; i++) {
  const c = await client.readContract({ ...factory, functionName: 'getDexConfig', args: [i] })
  console.log(`dexConfig[${i}]:`, JSON.stringify(c, (_, v) => typeof v === 'bigint' ? v.toString() : v))
}
