# Scalpel Services Market — API

Backend for the [Scalpel Services Market plugin](https://github.com/cccarv82/scalpel-services-market).

Powers in-plugin marketplace flows: Discord OAuth, services CRUD, request state machine, ratings, polling notifications, reports, admin ban.

## Live

- **API**: https://scalpel-services-market-api.vercel.app
- **Health**: https://scalpel-services-market-api.vercel.app/api/health

## Stack

- **Runtime**: Next.js 15 (App Router) on Vercel
- **DB**: Neon Postgres via `@neondatabase/serverless` driver
- **ORM**: Drizzle
- **Auth**: Discord OAuth2 (device-code style flow), 30-day session tokens (`Authorization: Bearer`)
- **Validation**: Zod

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | — | ok |
| GET | `/api/auth/start?device=X` | — | Browser → Discord redirect; `Accept: application/json` → `{code,authorizeUrl}` |
| GET | `/api/auth/callback` | — | Discord OAuth callback |
| GET | `/api/auth/poll?code=X` | — | Plugin polls; 202 pending / 200 ready / 404 expired |
| GET | `/api/me` | ✓ | Profile + rating average |
| PATCH | `/api/me` | ✓ | Edit char name / league / poeVersion (NOT displayName) |
| GET | `/api/services` | maybe | List with filters; `mine` / `includeInactive` need auth |
| POST | `/api/services` | ✓ | Create (max 5 active/user) |
| GET | `/api/services/:id` | — | |
| PATCH | `/api/services/:id` | ✓ | Owner only |
| DELETE | `/api/services/:id` | ✓ | Owner only |
| POST | `/api/services/:id/request` | ✓ | Client requests a service |
| POST | `/api/services/:id/report` | ✓ | Auto-flag after 3 reports |
| GET | `/api/requests?role=incoming\|outgoing` | ✓ | |
| GET | `/api/requests/:id` | ✓ | Both parties only |
| PATCH | `/api/requests/:id` | ✓ | `{action: accept\|decline\|complete\|cancel}` |
| POST | `/api/requests/:id/rate` | ✓ | 1-5 stars, only after `completed`, once per role |
| GET | `/api/events?since=&unreadOnly=` | ✓ | Polling for the plugin |
| PATCH | `/api/events/:id/read` | ✓ | |
| GET | `/api/users/:id` | — | Public profile + rating breakdown + recent ratings |
| POST | `/api/admin/users/:id/ban` | admin | `{banned: bool}`; bans + deactivates services + revokes sessions |
| POST | `/api/admin/cleanup` | cron secret | Purges expired sessions/device codes + read events older than 7d |

## Schema

```
users           id, discord_id (uq), discord_username, display_name,
                poe_char_name, default_league, poe_version, banned
services        id, user_id, category (enum), title, description,
                price_currency (enum), price_min, price_max, price_tiers (jsonb),
                tags[], poe_version, league, active, flagged
service_requests id, service_id, requester_id, provider_id, status (enum),
                requester_char_name, notes, *_at timestamps
ratings         id, request_id, rater_id, ratee_id, stars (1-5),
                role (enum), createdAt; unique (request_id, role)
events          id, user_id, kind (enum), payload (jsonb), read, created_at
sessions        id, user_id, token (uq), expires_at
device_codes    id, code (uq), user_id, session_token, expires_at
reports         id, service_id, reporter_id, reason; unique (service, reporter)
```

## Env

```
DATABASE_URL                 Neon connection (pooled)
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_REDIRECT_URI         https://your-domain/api/auth/callback
SESSION_SECRET               reserved (not currently signed; rotate anyway)
ALLOW_SELF_REQUEST_USER_IDS  dev/QA only; empty in production
ADMIN_USER_IDS               comma-separated user UUIDs allowed to call /api/admin/*
CRON_SECRET                  required by /api/admin/cleanup as Bearer token
```

## Dev

```bash
cp .env.example .env.local        # fill in values
npm install
npm run db:generate               # after editing db/schema.ts
npm run db:migrate                # apply to DATABASE_URL
npm run dev                       # localhost:3000
npm run typecheck
```

## License

AGPL-3.0-only.
