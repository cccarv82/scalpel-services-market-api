import {
  boolean,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const serviceCategoryEnum = pgEnum('service_category', [
  'act_carry',
  'boss_carry',
  'leveling_carry',
  'map_hosting',
  'trial_carry',
  'ascendancy_carry',
  'campaign_carry',
  'other',
])

export const priceCurrencyEnum = pgEnum('price_currency', [
  'chaos',
  'divine',
  'exalted',
  'mirror',
  'free_for_vouch',
])

export const requestStatusEnum = pgEnum('request_status', [
  'pending',
  'accepted',
  'declined',
  'completed',
  'cancelled',
])

export const ratingRoleEnum = pgEnum('rating_role', [
  'client_rates_provider',
  'provider_rates_client',
])

export const eventKindEnum = pgEnum('event_kind', [
  'new_request',
  'request_accepted',
  'request_declined',
  'request_completed',
  'request_cancelled',
  'new_rating',
])

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    discordId: text('discord_id').notNull(),
    discordUsername: text('discord_username').notNull(),
    displayName: text('display_name').notNull(),
    poeCharName: text('poe_char_name'),
    defaultLeague: text('default_league'),
    poeVersion: smallint('poe_version').default(2).notNull(),
    banned: boolean('banned').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    discordIdUnique: uniqueIndex('users_discord_id_uq').on(t.discordId),
  }),
)

export const services = pgTable(
  'services',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    category: serviceCategoryEnum('category').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    priceCurrency: priceCurrencyEnum('price_currency').notNull(),
    priceMin: numeric('price_min', { precision: 12, scale: 2 }),
    priceMax: numeric('price_max', { precision: 12, scale: 2 }),
    priceTiers: jsonb('price_tiers').notNull().default([]),
    tags: text('tags').array().notNull().default([]),
    poeVersion: smallint('poe_version').notNull(),
    league: text('league').notNull(),
    active: boolean('active').default(true).notNull(),
    flagged: boolean('flagged').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    listingIdx: index('services_listing_idx').on(t.poeVersion, t.league, t.active, t.createdAt),
    categoryIdx: index('services_category_idx').on(t.category),
  }),
)

export const serviceRequests = pgTable(
  'service_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serviceId: uuid('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
    requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    providerId: uuid('provider_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: requestStatusEnum('status').default('pending').notNull(),
    requesterCharName: text('requester_char_name').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    declinedAt: timestamp('declined_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index('requests_status_idx').on(t.status, t.createdAt),
    providerIdx: index('requests_provider_idx').on(t.providerId, t.status),
    requesterIdx: index('requests_requester_idx').on(t.requesterId, t.status),
  }),
)

export const ratings = pgTable(
  'ratings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requestId: uuid('request_id').notNull().references(() => serviceRequests.id, { onDelete: 'cascade' }),
    raterId: uuid('rater_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    rateeId: uuid('ratee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    stars: smallint('stars').notNull(),
    role: ratingRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    oneRatingPerRoleIdx: uniqueIndex('ratings_request_role_uq').on(t.requestId, t.role),
    rateeIdx: index('ratings_ratee_idx').on(t.rateeId),
  }),
)

export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: eventKindEnum('kind').notNull(),
    payload: jsonb('payload').notNull().default({}),
    read: boolean('read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userTsIdx: index('events_user_ts_idx').on(t.userId, t.createdAt),
  }),
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    tokenIdx: uniqueIndex('sessions_token_uq').on(t.token),
    userIdx: index('sessions_user_idx').on(t.userId),
  }),
)

export const deviceCodes = pgTable(
  'device_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    sessionToken: text('session_token'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    codeIdx: uniqueIndex('device_codes_code_uq').on(t.code),
  }),
)
