// JSON file persistence. Same shape as a future Postgres layer: swap the internals, keep the API.
// launches.json is public-ish data; vaults.json holds encrypted keys and never leaves the server.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { PROJECT_ROOT } from './load-env.js'

const DATA_DIR = path.join(PROJECT_ROOT, 'data')
mkdirSync(DATA_DIR, { recursive: true })

function load (name, fallback) {
  const p = path.join(DATA_DIR, name)
  if (!existsSync(p)) return fallback
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return fallback }
}

function save (name, value) {
  writeFileSync(path.join(DATA_DIR, name), JSON.stringify(value, null, 2))
}

// ---- launches ----------------------------------------------------------
let launches = load('launches.json', [])

export function allLaunches () { return launches }

export function getLaunch (idOrToken) {
  const q = String(idOrToken).toLowerCase()
  return launches.find(l => l.id === idOrToken || (l.token && l.token.toLowerCase() === q))
}

export function upsertLaunch (entry) {
  const i = launches.findIndex(l => l.id === entry.id)
  if (i >= 0) launches[i] = { ...launches[i], ...entry }
  else launches.push(entry)
  save('launches.json', launches)
  return getLaunch(entry.id)
}

export function findLaunchByFeeWallet (addr) {
  const q = String(addr).toLowerCase()
  return launches.find(l => l.feeWallet && l.feeWallet.toLowerCase() === q)
}

// ---- vaults (encrypted keys) ------------------------------------------
let vaults = load('vaults.json', {})

export function saveVault (address, encrypted) {
  vaults[address.toLowerCase()] = encrypted
  save('vaults.json', vaults)
}

export function getVault (address) {
  return vaults[String(address).toLowerCase()] || null
}

// ---- indexer cursor ----------------------------------------------------
let indexerState = load('indexer.json', {})

export function getIndexerState () { return indexerState }
export function setIndexerState (s) { indexerState = { ...indexerState, ...s }; save('indexer.json', indexerState) }
