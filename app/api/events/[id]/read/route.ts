import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Ctx {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  await db
    .update(schema.events)
    .set({ read: true })
    .where(and(eq(schema.events.id, id), eq(schema.events.userId, auth.id)))

  return NextResponse.json({ ok: true })
}
