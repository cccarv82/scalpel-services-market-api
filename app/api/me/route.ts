import { count, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const ratingAgg = await db
    .select({
      avg: sql<number>`coalesce(avg(${schema.ratings.stars}), 0)::float`,
      total: count(schema.ratings.id),
    })
    .from(schema.ratings)
    .where(eq(schema.ratings.rateeId, auth.id))

  return NextResponse.json({
    user: auth,
    rating: { average: ratingAgg[0]?.avg ?? 0, count: ratingAgg[0]?.total ?? 0 },
  })
}

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  poeCharName: z.string().trim().min(1).max(40).nullable().optional(),
  defaultLeague: z.string().trim().min(1).max(60).nullable().optional(),
  poeVersion: z.union([z.literal(1), z.literal(2)]).optional(),
})

export async function PATCH(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  await db
    .update(schema.users)
    .set({ ...parsed.data, updatedAt: sql`now()` })
    .where(eq(schema.users.id, auth.id))

  return NextResponse.json({ ok: true })
}
