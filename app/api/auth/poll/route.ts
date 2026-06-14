import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Plugin polls this with the device code it sent to /api/auth/start. When the
// Discord callback finishes, sessionToken is filled — return it and burn the
// device code.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'missing code' }, { status: 400 })

  const rows = await db.select().from(schema.deviceCodes).where(eq(schema.deviceCodes.code, code)).limit(1)
  const dc = rows[0]
  if (!dc) return NextResponse.json({ status: 'expired' }, { status: 404 })
  if (dc.expiresAt.getTime() < Date.now()) {
    await db.delete(schema.deviceCodes).where(eq(schema.deviceCodes.id, dc.id))
    return NextResponse.json({ status: 'expired' }, { status: 404 })
  }
  if (!dc.sessionToken || !dc.userId) {
    return NextResponse.json({ status: 'pending' }, { status: 202 })
  }

  const userRows = await db
    .select({
      id: schema.users.id,
      discordUsername: schema.users.discordUsername,
      displayName: schema.users.displayName,
      poeCharName: schema.users.poeCharName,
      defaultLeague: schema.users.defaultLeague,
      poeVersion: schema.users.poeVersion,
    })
    .from(schema.users)
    .where(eq(schema.users.id, dc.userId))
    .limit(1)
  const user = userRows[0]

  await db.delete(schema.deviceCodes).where(eq(schema.deviceCodes.id, dc.id))

  return NextResponse.json({ status: 'ready', token: dc.sessionToken, user })
}
