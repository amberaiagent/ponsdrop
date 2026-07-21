// Per-launch fee vault wallets. Private keys are AES-256-GCM encrypted with
// VAULT_ENCRYPTION_KEY (base64, 32 bytes) which lives only in .env.
import crypto from 'node:crypto'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { saveVault, getVault } from './store.js'

function key () {
  const raw = process.env.VAULT_ENCRYPTION_KEY
  if (!raw) throw new Error('VAULT_ENCRYPTION_KEY is not set. Generate one: openssl rand -base64 32')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) throw new Error('VAULT_ENCRYPTION_KEY must be 32 bytes base64')
  return buf
}

export function encryptSecret (plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: enc.toString('base64') }
}

export function decryptSecret (payload) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]).toString('utf8')
}

export function createVaultWallet () {
  const pk = generatePrivateKey()
  const account = privateKeyToAccount(pk)
  saveVault(account.address, { ...encryptSecret(pk), createdAt: new Date().toISOString() })
  return account.address
}

export function vaultAccount (address) {
  const stored = getVault(address)
  if (!stored) return null
  return privateKeyToAccount(decryptSecret(stored))
}
