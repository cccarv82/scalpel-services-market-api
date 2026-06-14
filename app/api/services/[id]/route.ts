import { and, count, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'
import { MAX_ACTIVE_SERVICES_PER_USER, serviceUpdateSchema } from '@/lib/schemas'
import { scanFields } from '@/lib/words'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Ctx {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

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
      flagged: schema.services.flagged,
      createdAt: schema.services.createdAt,
      providerId: schema.users.id,
      providerName: schema.users.displayName,
      providerCharName: schema.users.poeCharName,
      ratingAvg: sql<number>`coalesce((select avg(stars)::float from ratings where ratee_id = ${schema.users.id}), 0)`,
      ratingCount: sql<number>`(select count(*)::int from ratings where ratee_id = ${schema.users.id})`,
    })
    .from(schema.services)
    .innerJoin(schema.users, eq(schema.users.id, schema.services.userId))
    .where(eq(schema.services.id, id))
    .limit(1)

  if (!rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ service: rows[0] })
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const existing = await db.select().from(schema.services).where(eq(schema.services.id, id)).limit(1)
  if (!existing[0]) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing[0].userId !== auth.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const parsed = serviceUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  if (data.title || data.description || data.tags || data.priceTiers) {
    const tierLabels = (data.priceTiers ?? []).map((t) => t.label)
    const fields = [data.title ?? '', data.description ?? '', ...(data.tags ?? []), ...tierLabels]
    const scan = scanFields(...fields)
    if (!scan.ok) return NextResponse.json({ error: 'rmt_blocked', match: scan.match }, { status: 400 })
  }

  if (data.active === true && !existing[0].active) {
    const [{ activeCount }] = await db
      .select({ activeCount: count(schema.services.id) })
      .from(schema.services)
      .where(and(eq(schema.services.userId, auth.id), eq(schema.services.active, true)))
    if (activeCount >= MAX_ACTIVE_SERVICES_PER_USER) {
      return NextResponse.json({ error: 'limit_reached', max: MAX_ACTIVE_SERVICES_PER_USER }, { status: 429 })
    }
  }

  const update: Record<string, unknown> = { updatedAt: sql`now()` }
  if (data.category !== undefined) update.category = data.category
  if (data.title !== undefined) update.title = data.title
  if (data.description !== undefined) update.description = data.description
  if (data.priceCurrency !== undefined) update.priceCurrency = data.priceCurrency
  if (data.priceMin !== undefined) update.priceMin = data.priceMin == null ? null : data.priceMin.toString()
  if (data.priceMax !== undefined) update.priceMax = data.priceMax == null ? null : data.priceMax.toString()
  if (data.priceTiers !== undefined) update.priceTiers = data.priceTiers
  if (data.tags !== undefined) update.tags = data.tags
  if (data.poeVersion !== undefined) update.poeVersion = data.poeVersion
  if (data.league !== undefined) update.league = data.league
  if (data.active !== undefined) update.active = data.active

  await db.update(schema.services).set(update).where(eq(schema.services.id, id))
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const existing = await db.select().from(schema.services).where(eq(schema.services.id, id)).limit(1)
  if (!existing[0]) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing[0].userId !== auth.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  await db.delete(schema.services).where(eq(schema.services.id, id))
  return NextResponse.json({ ok: true })
}
