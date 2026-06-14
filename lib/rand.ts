import { randomBytes } from 'node:crypto'

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

export function randomCode(bytes = 12): string {
  return randomBytes(bytes).toString('base64url')
}
