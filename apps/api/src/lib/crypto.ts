import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGO      = 'aes-256-gcm'
const SALT_LEN  = 16
const IV_LEN    = 12
const TAG_LEN   = 16

/**
 * Derive a 32-byte key from a master secret + random salt.
 * scrypt is intentionally slow to slow down brute force on the master secret.
 */
function deriveKey(masterSecret: string, salt: Buffer): Buffer {
  return scryptSync(masterSecret, salt, 32) as Buffer
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns `salt:iv:authTag:ciphertext` as hex, colon-delimited.
 */
export function encrypt(plaintext: string, masterSecret: string): string {
  const salt   = randomBytes(SALT_LEN)
  const iv     = randomBytes(IV_LEN)
  const key    = deriveKey(masterSecret, salt)
  const cipher = createCipheriv(ALGO, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag   = cipher.getAuthTag()

  return [
    salt.toString('hex'),
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':')
}

/**
 * Decrypt a value produced by `encrypt()`.
 * Throws if the ciphertext is tampered with or the key is wrong.
 */
export function decrypt(encoded: string, masterSecret: string): string {
  const parts = encoded.split(':')
  if (parts.length !== 4) throw new Error('Invalid encrypted value format')

  const [saltHex, ivHex, tagHex, dataHex] = parts
  const salt    = Buffer.from(saltHex, 'hex')
  const iv      = Buffer.from(ivHex,   'hex')
  const authTag = Buffer.from(tagHex,  'hex')
  const data    = Buffer.from(dataHex, 'hex')
  const key     = deriveKey(masterSecret, salt)

  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
