import { and, desc, eq, gt } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'
import { eventsQuerySchema } from '@/lib/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Plugin polls this every ~10s. `since` is epoch ms of last seen event.
export async function GET(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const url = new URL(req.url)
  const parsed = eventsQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const q = parsed.data

  const filters = [eq(schema.events.userId, auth.id)]
  if (q.since) filters.push(gt(schema.events.createdAt, new Date(q.since)))
  if (q.unreadOnly) filters.push(eq(schema.events.read, false))

  const rows = await db
    .select()
    .from(schema.events)
    .where(and(...filters))
    .orderBy(desc(schema.events.createdAt))
    .limit(q.limit)

  return NextResponse.json({
    events: rows,
    serverTime: Date.now(),
  })
}
