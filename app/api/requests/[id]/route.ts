import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'
import { emitEvent, type EventKind } from '@/lib/events'
import { requestPatchSchema, type RequestTransition } from '@/lib/schemas'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Ctx {
  params: Promise<{ id: string }>
}

interface TransitionOk {
  from: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
  to: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
  actor: 'provider' | 'requester'
  setColumn: 'acceptedAt' | 'declinedAt' | 'completedAt' | 'cancelledAt'
  eventForOther: EventKind
}

const TRANSITIONS: Record<RequestTransition, TransitionOk[]> = {
  accept: [
    {
      from: 'pending',
      to: 'accepted',
      actor: 'provider',
      setColumn: 'acceptedAt',
      eventForOther: 'request_accepted',
    },
  ],
  decline: [
    {
      from: 'pending',
      to: 'declined',
      actor: 'provider',
      setColumn: 'declinedAt',
      eventForOther: 'request_declined',
    },
  ],
  complete: [
    {
      from: 'accepted',
      to: 'completed',
      actor: 'provider',
      setColumn: 'completedAt',
      eventForOther: 'request_completed',
    },
    {
      from: 'accepted',
      to: 'completed',
      actor: 'requester',
      setColumn: 'completedAt',
      eventForOther: 'request_completed',
    },
  ],
  cancel: [
    {
      from: 'pending',
      to: 'cancelled',
      actor: 'requester',
      setColumn: 'cancelledAt',
      eventForOther: 'request_cancelled',
    },
    {
      from: 'accepted',
      to: 'cancelled',
      actor: 'requester',
      setColumn: 'cancelledAt',
      eventForOther: 'request_cancelled',
    },
    {
      from: 'pending',
      to: 'cancelled',
      actor: 'provider',
      setColumn: 'cancelledAt',
      eventForOther: 'request_cancelled',
    },
  ],
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const rows = await db
    .select()
    .from(schema.serviceRequests)
    .where(eq(schema.serviceRequests.id, id))
    .limit(1)
  const r = rows[0]
  if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (r.providerId !== auth.id && r.requesterId !== auth.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return NextResponse.json({ request: r })
}

export async function PATCH(req: Request, ctx: Ctx) {
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
  const parsed = requestPatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { action } = parsed.data

  const rows = await db
    .select()
    .from(schema.serviceRequests)
    .where(eq(schema.serviceRequests.id, id))
    .limit(1)
  const r = rows[0]
  if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const isProvider = r.providerId === auth.id
  const isRequester = r.requesterId === auth.id
  if (!isProvider && !isRequester) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const actor: 'provider' | 'requester' = isProvider ? 'provider' : 'requester'
  const allowed = TRANSITIONS[action].find((t) => t.from === r.status && t.actor === actor)
  if (!allowed) {
    return NextResponse.json(
      { error: 'invalid_transition', from: r.status, action, actor },
      { status: 409 },
    )
  }

  await db
    .update(schema.serviceRequests)
    .set({ status: allowed.to, [allowed.setColumn]: sql`now()` })
    .where(eq(schema.serviceRequests.id, id))

  const otherId = isProvider ? r.requesterId : r.providerId
  await emitEvent(otherId, allowed.eventForOther, {
    requestId: id,
    serviceId: r.serviceId,
    actorId: auth.id,
  })

  return NextResponse.json({ ok: true, status: allowed.to })
}
