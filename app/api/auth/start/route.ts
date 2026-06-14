import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { authorizeUrl } from '@/lib/discord'
import { randomCode } from '@/lib/rand'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEVICE_CODE_TTL_MIN = 10

// Two modes:
//  1. Browser GET (Accept: text/html or */*) — creates code, 307 redirects to Discord.
//  2. Plugin GET with `Accept: application/json` — creates code, returns
//     { code, authorizeUrl } so the plugin can deterministically pre-create
//     the device code BEFORE opening the browser, avoiding a race where
//     poll() is called before the code exists.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const explicit = url.searchParams.get('device')?.trim() || null
  const code = explicit && /^[A-Za-z0-9_-]{8,64}$/.test(explicit) ? explicit : randomCode()
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MIN * 60 * 1000)

  // Insert idempotently — calling /start twice with the same device code (first
  // by the plugin via fetch, then by the browser via openExternal) must not
  // throw the second time.
  await db
    .insert(schema.deviceCodes)
    .values({ code, expiresAt })
    .onConflictDoNothing({ target: schema.deviceCodes.code })

  const accept = (req.headers.get('accept') || '').toLowerCase()
  if (accept.includes('application/json')) {
    return NextResponse.json({ code, authorizeUrl: authorizeUrl(code) })
  }
  return NextResponse.redirect(authorizeUrl(code))
}
