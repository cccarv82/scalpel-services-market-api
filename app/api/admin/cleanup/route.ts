import { and, eq, lt } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Manual/cron-triggered cleanup. Protect with Authorization: Bearer <CRON_SECRET>.
export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const now = Date.now()
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

  const deletedSessions = await db
    .delete(schema.sessions)
    .where(lt(schema.sessions.expiresAt, new Date(now)))
    .returning({ id: schema.sessions.id })

  const deletedDeviceCodes = await db
    .delete(schema.deviceCodes)
    .where(lt(schema.deviceCodes.expiresAt, new Date(now)))
    .returning({ id: schema.deviceCodes.id })

  const deletedEvents = await db
    .delete(schema.events)
    .where(and(eq(schema.events.read, true), lt(schema.events.createdAt, new Date(now - SEVEN_DAYS))))
    .returning({ id: schema.events.id })

  return NextResponse.json({
    deletedSessions: deletedSessions.length,
    deletedDeviceCodes: deletedDeviceCodes.length,
    deletedEvents: deletedEvents.length,
  })
}
