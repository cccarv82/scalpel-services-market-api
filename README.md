# Scalpel Services Market — API

Backend for the [Services Market plugin](https://github.com/cccarv82/scalpel-services-market) for [Scalpel](https://github.com/scalpelpoe/scalpel).

## Stack

- Next.js 15 (App Router) on Vercel
- Drizzle ORM + Neon Postgres
- Discord OAuth (device-code style)

## Dev

```bash
cp .env.example .env
# fill DATABASE_URL, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, SESSION_SECRET

npm install
npm run db:generate      # generate migration SQL
npm run db:migrate       # apply
npm run dev              # localhost:3000
```

## License

AGPL-3.0-only
