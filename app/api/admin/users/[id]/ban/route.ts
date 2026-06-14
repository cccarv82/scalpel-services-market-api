import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Ctx {
  params: Promise<{ id: string }>
}

const banSchema = z.object({
  banned: z.boolean(),
})

function isAdmin(userId: string): boolean {
  const allow = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return allow.includes(userId)
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  if (!isAdmin(auth.id)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const parsed = banSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  await db
    .update(schema.users)
    .set({ banned: parsed.data.banned, updatedAt: sql`now()` })
    .where(eq(schema.users.id, id))

  if (parsed.data.banned) {
    await db
      .update(schema.services)
      .set({ active: false, updatedAt: sql`now()` })
      .where(eq(schema.services.userId, id))
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, id))
  }

  return NextResponse.json({ ok: true })
}
