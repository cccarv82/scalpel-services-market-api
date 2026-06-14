import { count, desc, eq, inArray, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Ctx {
  params: Promise<{ id: string }>
}

// Public profile: display name, char name, league, aggregate rating, active services count, completed jobs.
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const rows = await db
    .select({
      id: schema.users.id,
      displayName: schema.users.displayName,
      poeCharName: schema.users.poeCharName,
      defaultLeague: schema.users.defaultLeague,
      poeVersion: schema.users.poeVersion,
      createdAt: schema.users.createdAt,
      banned: schema.users.banned,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1)

  const user = rows[0]
  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (user.banned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const [{ avg, total }] = await db
    .select({
      avg: sql<number>`coalesce(avg(${schema.ratings.stars}), 0)::float`,
      total: count(schema.ratings.id),
    })
    .from(schema.ratings)
    .where(eq(schema.ratings.rateeId, id))

  const [{ activeServices }] = await db
    .select({ activeServices: count(schema.services.id) })
    .from(schema.services)
    .where(sql`${schema.services.userId} = ${id} AND ${schema.services.active} = true AND ${schema.services.flagged} = false`)

  const [{ completedJobs }] = await db
    .select({ completedJobs: count(schema.serviceRequests.id) })
    .from(schema.serviceRequests)
    .where(
      sql`${schema.serviceRequests.providerId} = ${id} AND ${schema.serviceRequests.status} = 'completed'`,
    )

  const recent = await db
    .select({
      id: schema.services.id,
      title: schema.services.title,
      category: schema.services.category,
      priceCurrency: schema.services.priceCurrency,
      priceMin: schema.services.priceMin,
      priceMax: schema.services.priceMax,
      league: schema.services.league,
      poeVersion: schema.services.poeVersion,
    })
    .from(schema.services)
    .where(
      sql`${schema.services.userId} = ${id} AND ${schema.services.active} = true AND ${schema.services.flagged} = false`,
    )
    .orderBy(desc(schema.services.createdAt))
    .limit(5)

  void inArray

  return NextResponse.json({
    user: {
      id: user.id,
      displayName: user.displayName,
      poeCharName: user.poeCharName,
      defaultLeague: user.defaultLeague,
      poeVersion: user.poeVersion,
      createdAt: user.createdAt,
    },
    rating: { average: avg, count: total },
    stats: { activeServices, completedJobs },
    activeServices: recent,
  })
}
