import { z } from 'zod'

export const SERVICE_CATEGORIES = [
  'act_carry',
  'boss_carry',
  'leveling_carry',
  'map_hosting',
  'trial_carry',
  'ascendancy_carry',
  'other',
] as const

export const PRICE_CURRENCIES = ['chaos', 'divine', 'exalted', 'mirror', 'free_for_vouch'] as const

export const POE_VERSIONS = [1, 2] as const

export const serviceCreateSchema = z
  .object({
    category: z.enum(SERVICE_CATEGORIES),
    title: z.string().trim().min(3).max(80),
    description: z.string().trim().min(3).max(2000),
    priceCurrency: z.enum(PRICE_CURRENCIES),
    priceMin: z.number().nonnegative().nullable().optional(),
    priceMax: z.number().nonnegative().nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(24)).max(6).default([]),
    poeVersion: z.union([z.literal(1), z.literal(2)]),
    league: z.string().trim().min(1).max(60),
  })
  .superRefine((v, ctx) => {
    if (v.priceCurrency === 'free_for_vouch') return
    if (v.priceMin == null && v.priceMax == null) {
      ctx.addIssue({ code: 'custom', message: 'priceMin or priceMax required unless free_for_vouch', path: ['priceMin'] })
    }
    if (v.priceMin != null && v.priceMax != null && v.priceMin > v.priceMax) {
      ctx.addIssue({ code: 'custom', message: 'priceMin > priceMax', path: ['priceMin'] })
    }
  })

export const serviceUpdateSchema = z.object({
  category: z.enum(SERVICE_CATEGORIES).optional(),
  title: z.string().trim().min(3).max(80).optional(),
  description: z.string().trim().min(3).max(2000).optional(),
  priceCurrency: z.enum(PRICE_CURRENCIES).optional(),
  priceMin: z.number().nonnegative().nullable().optional(),
  priceMax: z.number().nonnegative().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(6).optional(),
  poeVersion: z.union([z.literal(1), z.literal(2)]).optional(),
  league: z.string().trim().min(1).max(60).optional(),
  active: z.boolean().optional(),
})

export const listQuerySchema = z.object({
  league: z.string().trim().min(1).optional(),
  poeVersion: z.coerce.number().int().refine((n) => n === 1 || n === 2).optional(),
  category: z.enum(SERVICE_CATEGORIES).optional(),
  q: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  mine: z.coerce.boolean().optional(),
  includeInactive: z.coerce.boolean().optional(),
})

export const MAX_ACTIVE_SERVICES_PER_USER = 10
