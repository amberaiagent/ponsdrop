// Central config for robindrop. Values that must stay secret live in .env (see load-env.js).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const abi = (name) => JSON.parse(readFileSync(path.join(here, '..', 'config', name), 'utf8'))

export const CHAIN = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
}

export const ADDRESSES = {
  factory: '0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB',
  locker: '0x736D76699C26D0d966744cAe304C000d471f7F35',
  weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  dead: '0x000000000000000000000000000000000000dEaD',
}

export const FACTORY_START_BLOCK = 8991118n

export const FACTORY_ABI = abi('factory-abi.json')
export const LOCKER_ABI = abi('locker-abi.json')

export const BLOCKSCOUT_API = 'https://robinhoodchain.blockscout.com/api/v2'

// Platform defaults for the holders-airdrop mode (trench heritage)
export const DROP_DEFAULTS = {
  holderFrom: 1,
  holderTo: 200,
  rounds: 2,
  pctPerRound: 50,
  splitBasis: 'remaining', // 'remaining' | 'total'
  capMode: 'multiply',     // 'multiply' | 'step'
  capFactor: 2,
  capStep: 0,              // USD, used when capMode === 'step'
  trigger: 'mcap',         // 'mcap' | 'interval'
  intervalHours: 24,       // used when trigger === 'interval'
}

export const LIMITS = {
  holderMax: 1000,
  roundsMax: 30,
}
