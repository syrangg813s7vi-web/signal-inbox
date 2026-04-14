CREATE TABLE "inbox_selections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"relevance_score" real NOT NULL,
	"score_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"selection_reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"policy_version" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "source_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."source_type";--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('rss');--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "source_type" SET DATA TYPE "public"."source_type" USING "source_type"::"public"."source_type";--> statement-breakpoint
ALTER TABLE "inbox_selections" ADD CONSTRAINT "inbox_selections_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_selections_current_item_id_key" ON "inbox_selections" USING btree ("item_id") WHERE "inbox_selections"."is_current" is true;--> statement-breakpoint
CREATE INDEX "inbox_selections_current_selected_idx" ON "inbox_selections" USING btree ("is_current","selected");--> statement-breakpoint
CREATE INDEX "inbox_selections_relevance_score_idx" ON "inbox_selections" USING btree ("relevance_score");