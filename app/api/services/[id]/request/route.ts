import { and, count, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'
import { emitEvent } from '@/lib/events'
import { MAX_OPEN_REQUESTS_PER_USER, requestCreateSchema } from '@/lib/schemas'
import { scanFields } from '@/lib/words'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Ctx {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, ctx: Ctx) {
  const { id: serviceId } = await ctx.params
  if (!UUID_RE.test(serviceId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const parsed = requestCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  const scan = scanFields(data.requesterCharName, data.notes ?? '')
  if (!scan.ok) return NextResponse.json({ error: 'rmt_blocked', match: scan.match }, { status: 400 })

  const svc = await db.select().from(schema.services).where(eq(schema.services.id, serviceId)).limit(1)
  if (!svc[0]) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (svc[0].flagged) return NextResponse.json({ error: 'service unavailable' }, { status: 410 })
  if (!svc[0].active) return NextResponse.json({ error: 'service inactive' }, { status: 410 })
  if (svc[0].userId === auth.id) {
    const allow = (process.env.ALLOW_SELF_REQUEST_USER_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!allow.includes(auth.id)) {
      return NextResponse.json({ error: 'cannot request own service' }, { status: 400 })
    }
  }

  // Rate limit: max open requests per client across services
  const [{ openCount }] = await db
    .select({ openCount: count(schema.serviceRequests.id) })
    .from(schema.serviceRequests)
    .where(
      and(
        eq(schema.serviceRequests.requesterId, auth.id),
        inArray(schema.serviceRequests.status, ['pending', 'accepted']),
      ),
    )
  if (openCount >= MAX_OPEN_REQUESTS_PER_USER) {
    return NextResponse.json(
      { error: 'limit_reached', max: MAX_OPEN_REQUESTS_PER_USER },
      { status: 429 },
    )
  }

  // Prevent duplicate pending request to same service by same user
  const existing = await db
    .select({ id: schema.serviceRequests.id })
    .from(schema.serviceRequests)
    .where(
      and(
        eq(schema.serviceRequests.serviceId, serviceId),
        eq(schema.serviceRequests.requesterId, auth.id),
        inArray(schema.serviceRequests.status, ['pending', 'accepted']),
      ),
    )
    .limit(1)
  if (existing[0]) {
    return NextResponse.json({ error: 'duplicate_open_request', id: existing[0].id }, { status: 409 })
  }

  const inserted = await db
    .insert(schema.serviceRequests)
    .values({
      serviceId,
      requesterId: auth.id,
      providerId: svc[0].userId,
      requesterCharName: data.requesterCharName,
      notes: data.notes,
    })
    .returning({ id: schema.serviceRequests.id })

  const requestId = inserted[0].id
  await emitEvent(svc[0].userId, 'new_request', {
    requestId,
    serviceId,
    serviceTitle: svc[0].title,
    requesterId: auth.id,
    requesterName: auth.displayName,
    requesterCharName: data.requesterCharName,
  })

  return NextResponse.json({ id: requestId }, { status: 201 })
}
