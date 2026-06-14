import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { createSessionForUser } from '@/lib/auth'
import { exchangeCode, fetchUser } from '@/lib/discord'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) return page('Missing code or state.', 400)

  // Validate device code is still pending
  const dc = await db.select().from(schema.deviceCodes).where(eq(schema.deviceCodes.code, state)).limit(1)
  if (!dc[0]) return page('Unknown or expired login session.', 400)
  if (dc[0].expiresAt.getTime() < Date.now()) return page('Login session expired. Restart from Scalpel.', 400)
  if (dc[0].userId) return page('This login session was already completed.', 400)

  let access: string
  let discordUser: { id: string; username: string; global_name?: string | null }
  try {
    access = await exchangeCode(code)
    discordUser = await fetchUser(access)
  } catch (e) {
    return page(`Discord auth failed: ${(e as Error).message}`, 500)
  }

  // Upsert user
  const displayName = (discordUser.global_name?.trim() || discordUser.username).slice(0, 80)
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.discordId, discordUser.id))
    .limit(1)

  let userId: string
  if (existing[0]) {
    userId = existing[0].id
    if (existing[0].banned) return page('Account banned.', 403)
    await db
      .update(schema.users)
      .set({ discordUsername: discordUser.username, updatedAt: sql`now()` })
      .where(eq(schema.users.id, userId))
  } else {
    const inserted = await db
      .insert(schema.users)
      .values({
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        displayName,
      })
      .returning({ id: schema.users.id })
    userId = inserted[0].id
  }

  const sessionToken = await createSessionForUser(userId)

  await db
    .update(schema.deviceCodes)
    .set({ userId, sessionToken })
    .where(eq(schema.deviceCodes.code, state))

  return page('Connected. You can return to Scalpel.', 200)
}

function page(message: string, status: number) {
  const safe = message.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] as string)
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Scalpel Services Market</title></head><body style="font-family:system-ui;background:#0e0e12;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center;max-width:480px;padding:24px"><h2 style="color:#f0a020">Scalpel Services Market</h2><p>${safe}</p><p style="opacity:.6;font-size:14px">You can close this tab.</p></div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
