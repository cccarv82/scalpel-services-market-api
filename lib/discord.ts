const DISCORD_OAUTH = 'https://discord.com/oauth2/authorize'
const DISCORD_TOKEN = 'https://discord.com/api/oauth2/token'
const DISCORD_USER = 'https://discord.com/api/users/@me'

export interface DiscordUser {
  id: string
  username: string
  global_name?: string | null
}

export function authorizeUrl(state: string): string {
  const u = new URL(DISCORD_OAUTH)
  u.searchParams.set('client_id', mustEnv('DISCORD_CLIENT_ID'))
  u.searchParams.set('redirect_uri', mustEnv('DISCORD_REDIRECT_URI'))
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', 'identify')
  u.searchParams.set('state', state)
  u.searchParams.set('prompt', 'none')
  return u.toString()
}

export async function exchangeCode(code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: mustEnv('DISCORD_CLIENT_ID'),
    client_secret: mustEnv('DISCORD_CLIENT_SECRET'),
    grant_type: 'authorization_code',
    code,
    redirect_uri: mustEnv('DISCORD_REDIRECT_URI'),
  })
  const res = await fetch(DISCORD_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Discord token exchange failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

export async function fetchUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(DISCORD_USER, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Discord user fetch failed: ${res.status}`)
  return (await res.json()) as DiscordUser
}

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}
