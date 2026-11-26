import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'

// File format: one marker byte ("E" encrypted with the OS keychain, "P" plain) followed by the payload.
const tokenFile = () => join(app.getPath('userData'), 'figma-token')

export function getFigmaToken(): string | null {
  try {
    const data = readFileSync(tokenFile())
    const payload = data.subarray(1)
    const token = data[0] === 0x45 /* E */ ? safeStorage.decryptString(payload) : payload.toString('utf8')
    return token || null
  }
  catch {
    return null
  }
}

export function setFigmaToken(token: string): void {
  const encrypted = safeStorage.isEncryptionAvailable()
  const payload = encrypted ? safeStorage.encryptString(token) : Buffer.from(token, 'utf8')
  writeFileSync(tokenFile(), Buffer.concat([Buffer.from(encrypted ? 'E' : 'P'), payload]), { mode: 0o600 })
}

export function clearFigmaToken(): void {
  rmSync(tokenFile(), { force: true })
}
