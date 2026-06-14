import { eq, lt } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { randomToken } from './rand'

const SESSION_DAYS = 30

export interface AuthedUser {
  id: string
  discordId: string
  discordUsername: string
  displayName: string
  poeCharName: string | null
  defaultLeague: string | null
  poeVersion: number
}

export async function createSessionForUser(userId: string): Promise<string> {
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db.insert(schema.sessions).values({ userId, token, expiresAt })
  return token
}

export async function getUserFromRequest(req: Request): Promise<AuthedUser | null> {
  const h = req.headers.get('authorization')
  if (!h || !h.toLowerCase().startsWith('bearer ')) return null
  const token = h.slice(7).trim()
  if (!token) return null

  const rows = await db
    .select({
      id: schema.users.id,
      discordId: schema.users.discordId,
      discordUsername: schema.users.discordUsername,
      displayName: schema.users.displayName,
      poeCharName: schema.users.poeCharName,
      defaultLeague: schema.users.defaultLeague,
      poeVersion: schema.users.poeVersion,
      banned: schema.users.banned,
      expiresAt: schema.sessions.expiresAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.token, token))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  if (row.banned) return null
  if (row.expiresAt.getTime() < Date.now()) return null

  return {
    id: row.id,
    discordId: row.discordId,
    discordUsername: row.discordUsername,
    displayName: row.displayName,
    poeCharName: row.poeCharName,
    defaultLeague: row.defaultLeague,
    poeVersion: row.poeVersion,
  }
}

export async function requireUser(req: Request): Promise<AuthedUser | NextResponse> {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return user
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()))
}
