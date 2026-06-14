import { count, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'
import { reportSchema } from '@/lib/schemas'
import { REPORT_FLAG_THRESHOLD } from '@/db/schema'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Ctx {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const parsed = reportSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const svc = await db.select().from(schema.services).where(eq(schema.services.id, id)).limit(1)
  if (!svc[0]) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (svc[0].userId === auth.id) {
    return NextResponse.json({ error: 'cannot report own service' }, { status: 400 })
  }

  try {
    await db.insert(schema.reports).values({
      serviceId: id,
      reporterId: auth.id,
      reason: parsed.data.reason,
    })
  } catch (e) {
    if (/duplicate|unique/i.test((e as Error).message)) {
      return NextResponse.json({ error: 'already_reported' }, { status: 409 })
    }
    throw e
  }

  const [{ total }] = await db
    .select({ total: count(schema.reports.id) })
    .from(schema.reports)
    .where(eq(schema.reports.serviceId, id))

  if (total >= REPORT_FLAG_THRESHOLD && !svc[0].flagged) {
    await db
      .update(schema.services)
      .set({ flagged: true, active: false, updatedAt: sql`now()` })
      .where(eq(schema.services.id, id))
  }

  return NextResponse.json({ ok: true, totalReports: total })
}
