import { db, schema } from '@/db'

export type EventKind =
  | 'new_request'
  | 'request_accepted'
  | 'request_declined'
  | 'request_completed'
  | 'request_cancelled'
  | 'new_rating'

export async function emitEvent(
  userId: string,
  kind: EventKind,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(schema.events).values({ userId, kind, payload })
}
