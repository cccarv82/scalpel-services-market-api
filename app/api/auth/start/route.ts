import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { authorizeUrl } from '@/lib/discord'
import { randomCode } from '@/lib/rand'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEVICE_CODE_TTL_MIN = 10

// Plugin opens this URL in the user's browser. Server creates a device code,
// stores it, and redirects to Discord OAuth using the code as `state`.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const explicit = url.searchParams.get('device')?.trim() || null
  const code = explicit && /^[A-Za-z0-9_-]{8,64}$/.test(explicit) ? explicit : randomCode()

  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MIN * 60 * 1000)

  await db.insert(schema.deviceCodes).values({ code, expiresAt })

  return NextResponse.redirect(authorizeUrl(code))
}
