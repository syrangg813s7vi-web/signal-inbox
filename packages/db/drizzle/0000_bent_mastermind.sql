CREATE TYPE "public"."capture_entry_status" AS ENUM('captured', 'normalized', 'failed');--> statement-breakpoint
CREATE TYPE "public"."capture_entry_type" AS ENUM('source_sync', 'manual_link');--> statement-breakpoint
CREATE TYPE "public"."item_group_type" AS ENUM('topic');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('new', 'processed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('article');--> statement-breakpoint
CREATE TYPE "public"."raw_asset_status" AS ENUM('new', 'normalized', 'failed');--> statement-breakpoint
CREATE TYPE "public"."raw_asset_type" AS ENUM('url', 'article');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('active', 'paused', 'error');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('rss');--> statement-breakpoint
CREATE TABLE "capture_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entry_type" "capture_entry_type" NOT NULL,
	"source_id" uuid,
	"trigger_ref" text,
	"status" "capture_entry_status" DEFAULT 'captured' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrichments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"importance_score" real,
	"novelty_score" real,
	"summary_short" text,
	"summary_long" text,
	"key_points" text[],
	"tags" text[],
	"topic" text,
	"classification" text,
	"ai_commentary" text,
	"dedupe_key" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_group_members" (
	"group_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	CONSTRAINT "item_group_members_pkey" PRIMARY KEY("group_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "item_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_type" "item_group_type" NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"tag" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"raw_asset_id" uuid NOT NULL,
	"item_type" "item_type" NOT NULL,
	"title" text,
	"canonical_url" text,
	"author" text,
	"published_at" timestamp with time zone,
	"language" text,
	"content_text" text,
	"status" "item_status" DEFAULT 'new' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"capture_entry_id" uuid NOT NULL,
	"asset_type" "raw_asset_type" NOT NULL,
	"external_id" text,
	"title" text,
	"author" text,
	"url" text,
	"published_at" timestamp with time zone,
	"raw_content" text,
	"raw_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "raw_asset_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_sync_state" (
	"source_id" uuid PRIMARY KEY NOT NULL,
	"cursor" text,
	"last_synced_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error_message" text
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_ref" text NOT NULL,
	"source_url" text,
	"status" "source_status" DEFAULT 'active' NOT NULL,
	"topic" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capture_entries" ADD CONSTRAINT "capture_entries_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichments" ADD CONSTRAINT "enrichments_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_group_members" ADD CONSTRAINT "item_group_members_group_id_item_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."item_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_group_members" ADD CONSTRAINT "item_group_members_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_raw_asset_id_raw_assets_id_fk" FOREIGN KEY ("raw_asset_id") REFERENCES "public"."raw_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_assets" ADD CONSTRAINT "raw_assets_capture_entry_id_capture_entries_id_fk" FOREIGN KEY ("capture_entry_id") REFERENCES "public"."capture_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_sync_state" ADD CONSTRAINT "source_sync_state_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capture_entries_source_id_idx" ON "capture_entries" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "capture_entries_status_idx" ON "capture_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "capture_entries_captured_at_idx" ON "capture_entries" USING btree ("captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "enrichments_item_id_key" ON "enrichments" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "enrichments_dedupe_key_idx" ON "enrichments" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "enrichments_topic_idx" ON "enrichments" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "item_group_members_item_id_idx" ON "item_group_members" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_groups_group_type_idx" ON "item_groups" USING btree ("group_type");--> statement-breakpoint
CREATE INDEX "item_groups_tag_idx" ON "item_groups" USING btree ("tag");--> statement-breakpoint
CREATE UNIQUE INDEX "items_raw_asset_id_key" ON "items" USING btree ("raw_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_canonical_url_key" ON "items" USING btree ("canonical_url") WHERE "items"."canonical_url" is not null;--> statement-breakpoint
CREATE INDEX "items_status_idx" ON "items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "items_published_at_idx" ON "items" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "raw_assets_capture_entry_id_idx" ON "raw_assets" USING btree ("capture_entry_id");--> statement-breakpoint
CREATE INDEX "raw_assets_status_idx" ON "raw_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "raw_assets_url_idx" ON "raw_assets" USING btree ("url");--> statement-breakpoint
CREATE INDEX "raw_assets_published_at_idx" ON "raw_assets" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_source_type_source_ref_key" ON "sources" USING btree ("source_type","source_ref");--> statement-breakpoint
CREATE INDEX "sources_status_idx" ON "sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sources_topic_idx" ON "sources" USING btree ("topic");
