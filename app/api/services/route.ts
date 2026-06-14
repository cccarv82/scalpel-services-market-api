import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'
import { MAX_ACTIVE_SERVICES_PER_USER, listQuerySchema, serviceCreateSchema } from '@/lib/schemas'
import { scanFields } from '@/lib/words'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const q = parsed.data

  const filters = [eq(schema.services.flagged, false)]

  let viewerId: string | null = null
  if (q.mine || q.includeInactive) {
    const auth = await requireUser(req)
    if (auth instanceof NextResponse) return auth
    viewerId = auth.id
    if (q.mine) filters.push(eq(schema.services.userId, viewerId))
  }

  if (!q.includeInactive) filters.push(eq(schema.services.active, true))
  if (q.league) filters.push(eq(schema.services.league, q.league))
  if (q.poeVersion) filters.push(eq(schema.services.poeVersion, q.poeVersion))
  if (q.category) filters.push(eq(schema.services.category, q.category))
  if (q.q) {
    const like = `%${q.q}%`
    filters.push(or(ilike(schema.services.title, like), ilike(schema.services.description, like))!)
  }

  const where = and(...filters)
  const offset = (q.page - 1) * q.pageSize

  const rows = await db
    .select({
      id: schema.services.id,
      category: schema.services.category,
      title: schema.services.title,
      description: schema.services.description,
      priceCurrency: schema.services.priceCurrency,
      priceMin: schema.services.priceMin,
      priceMax: schema.services.priceMax,
      priceTiers: schema.services.priceTiers,
      tags: schema.services.tags,
      poeVersion: schema.services.poeVersion,
      league: schema.services.league,
      active: schema.services.active,
      createdAt: schema.services.createdAt,
      providerId: schema.users.id,
      providerName: schema.users.displayName,
      providerCharName: schema.users.poeCharName,
      ratingAvg: sql<number>`coalesce((select avg(stars)::float from ratings where ratee_id = ${schema.users.id}), 0)`,
      ratingCount: sql<number>`(select count(*)::int from ratings where ratee_id = ${schema.users.id})`,
    })
    .from(schema.services)
    .innerJoin(schema.users, eq(schema.users.id, schema.services.userId))
    .where(where)
    .orderBy(desc(schema.services.createdAt))
    .limit(q.pageSize)
    .offset(offset)

  const [{ total }] = await db
    .select({ total: count(schema.services.id) })
    .from(schema.services)
    .where(where)

  return NextResponse.json({ services: rows, page: q.page, pageSize: q.pageSize, total })
}

export async function POST(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const parsed = serviceCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  const tierLabels = (data.priceTiers ?? []).map((t) => t.label)
  const scan = scanFields(data.title, data.description, ...data.tags, ...tierLabels)
  if (!scan.ok) return NextResponse.json({ error: 'rmt_blocked', match: scan.match }, { status: 400 })

  const [{ activeCount }] = await db
    .select({ activeCount: count(schema.services.id) })
    .from(schema.services)
    .where(and(eq(schema.services.userId, auth.id), eq(schema.services.active, true)))

  if (activeCount >= MAX_ACTIVE_SERVICES_PER_USER) {
    return NextResponse.json(
      { error: 'limit_reached', max: MAX_ACTIVE_SERVICES_PER_USER },
      { status: 429 },
    )
  }

  const inserted = await db
    .insert(schema.services)
    .values({
      userId: auth.id,
      category: data.category,
      title: data.title,
      description: data.description,
      priceCurrency: data.priceCurrency,
      priceMin: data.priceMin != null ? data.priceMin.toString() : null,
      priceMax: data.priceMax != null ? data.priceMax.toString() : null,
      priceTiers: data.priceTiers ?? [],
      tags: data.tags,
      poeVersion: data.poeVersion,
      league: data.league,
    })
    .returning({ id: schema.services.id })

  return NextResponse.json({ id: inserted[0].id }, { status: 201 })
}
