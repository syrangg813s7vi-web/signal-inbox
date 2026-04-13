CREATE TYPE "public"."preserve_recommendation" AS ENUM('keep', 'discard', 'review');--> statement-breakpoint
DROP INDEX "enrichments_item_id_key";--> statement-breakpoint
ALTER TABLE "enrichments" ADD COLUMN "why_it_matters" text;--> statement-breakpoint
ALTER TABLE "enrichments" ADD COLUMN "preserve_recommendation" "preserve_recommendation";--> statement-breakpoint
ALTER TABLE "enrichments" ADD COLUMN "note_draft" text;--> statement-breakpoint
ALTER TABLE "enrichments" ADD COLUMN "is_current" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "enrichments" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "enrichments_current_item_id_key" ON "enrichments" USING btree ("item_id") WHERE "enrichments"."is_current" is true;