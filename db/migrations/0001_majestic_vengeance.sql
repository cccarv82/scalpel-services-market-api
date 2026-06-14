ALTER TYPE "public"."service_category" ADD VALUE 'campaign_carry' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "price_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL;