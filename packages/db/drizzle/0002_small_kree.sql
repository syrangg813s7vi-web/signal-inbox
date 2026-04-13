CREATE TYPE "public"."knowledge_destination_status" AS ENUM('active', 'disabled', 'error');--> statement-breakpoint
CREATE TYPE "public"."knowledge_destination_type" AS ENUM('notion', 'obsidian');--> statement-breakpoint
CREATE TYPE "public"."note_type" AS ENUM('reference', 'summary');--> statement-breakpoint
CREATE TABLE "knowledge_destinations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"destination_type" "knowledge_destination_type" NOT NULL,
	"name" text NOT NULL,
	"target_ref" text NOT NULL,
	"status" "knowledge_destination_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"note_type" "note_type" NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"highlights" text[] DEFAULT '{}'::text[] NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"review_weight" real,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_destinations_type_target_ref_key" ON "knowledge_destinations" USING btree ("destination_type","target_ref");--> statement-breakpoint
CREATE INDEX "knowledge_destinations_status_idx" ON "knowledge_destinations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_item_id_key" ON "notes" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "notes_note_type_idx" ON "notes" USING btree ("note_type");--> statement-breakpoint
CREATE INDEX "notes_created_at_idx" ON "notes" USING btree ("created_at");