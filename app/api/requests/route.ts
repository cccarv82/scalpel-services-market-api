import { and, count, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'
import { requestListQuerySchema } from '@/lib/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Convenience: ?role=incoming|outgoing splits provider vs requester view.
export async function GET(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const url = new URL(req.url)
  const role = url.searchParams.get('role') === 'outgoing' ? 'outgoing' : 'incoming'
  const parsed = requestListQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const q = parsed.data

  const filters = [
    role === 'incoming'
      ? eq(schema.serviceRequests.providerId, auth.id)
      : eq(schema.serviceRequests.requesterId, auth.id),
  ]
  if (q.status) filters.push(eq(schema.serviceRequests.status, q.status))

  const where = and(...filters)
  const offset = (q.page - 1) * q.pageSize

  const counterparty = role === 'incoming' ? schema.serviceRequests.requesterId : schema.serviceRequests.providerId

  const rows = await db
    .select({
      id: schema.serviceRequests.id,
      status: schema.serviceRequests.status,
      requesterCharName: schema.serviceRequests.requesterCharName,
      notes: schema.serviceRequests.notes,
      createdAt: schema.serviceRequests.createdAt,
      acceptedAt: schema.serviceRequests.acceptedAt,
      completedAt: schema.serviceRequests.completedAt,
      cancelledAt: schema.serviceRequests.cancelledAt,
      declinedAt: schema.serviceRequests.declinedAt,
      service: {
        id: schema.services.id,
        title: schema.services.title,
        category: schema.services.category,
        priceCurrency: schema.services.priceCurrency,
        priceMin: schema.services.priceMin,
        priceMax: schema.services.priceMax,
        league: schema.services.league,
        poeVersion: schema.services.poeVersion,
      },
      counterparty: {
        id: schema.users.id,
        displayName: schema.users.displayName,
        poeCharName: schema.users.poeCharName,
      },
    })
    .from(schema.serviceRequests)
    .innerJoin(schema.services, eq(schema.services.id, schema.serviceRequests.serviceId))
    .innerJoin(schema.users, eq(schema.users.id, counterparty))
    .where(where)
    .orderBy(desc(schema.serviceRequests.createdAt))
    .limit(q.pageSize)
    .offset(offset)

  const [{ total }] = await db
    .select({ total: count(schema.serviceRequests.id) })
    .from(schema.serviceRequests)
    .where(where)

  return NextResponse.json({ requests: rows, role, page: q.page, pageSize: q.pageSize, total })
}
