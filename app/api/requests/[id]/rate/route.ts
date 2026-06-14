import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'
import { emitEvent } from '@/lib/events'
import { rateSchema } from '@/lib/schemas'

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
  const parsed = rateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const rows = await db
    .select()
    .from(schema.serviceRequests)
    .where(eq(schema.serviceRequests.id, id))
    .limit(1)
  const r = rows[0]
  if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (r.status !== 'completed') {
    return NextResponse.json({ error: 'request_not_completed' }, { status: 409 })
  }

  const isProvider = r.providerId === auth.id
  const isRequester = r.requesterId === auth.id
  if (!isProvider && !isRequester) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const role = isProvider ? 'provider_rates_client' : 'client_rates_provider'
  const rateeId = isProvider ? r.requesterId : r.providerId

  try {
    await db.insert(schema.ratings).values({
      requestId: id,
      raterId: auth.id,
      rateeId,
      stars: parsed.data.stars,
      role,
    })
  } catch (e) {
    // Unique constraint (request_id, role) — already rated
    if (/duplicate|unique/i.test((e as Error).message)) {
      return NextResponse.json({ error: 'already_rated' }, { status: 409 })
    }
    throw e
  }

  await emitEvent(rateeId, 'new_rating', {
    requestId: id,
    stars: parsed.data.stars,
    raterId: auth.id,
  })

  return NextResponse.json({ ok: true })
}
