import { createSqlClient } from "./client";
import { bootstrapSourceStorageSchema } from "./source-storage-bootstrap";

export async function bootstrapInboxStorageSchema(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set before bootstrapping inbox storage.");
  }

  await bootstrapSourceStorageSchema(databaseUrl);

  const client = createSqlClient(databaseUrl);

  try {
    await client.begin(async (transaction) => {
      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'capture_entry_type') then
            create type "capture_entry_type" as enum ('source_sync', 'manual_link');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if exists (select 1 from pg_type where typname = 'capture_entry_type')
            and not exists (
              select 1
              from pg_enum
              where enumlabel = 'url_submission'
                and enumtypid = 'capture_entry_type'::regtype
            ) then
            alter type "capture_entry_type" add value 'url_submission';
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'capture_entry_status') then
            create type "capture_entry_status" as enum ('captured', 'normalized', 'failed');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'raw_asset_type') then
            create type "raw_asset_type" as enum ('url', 'article');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if exists (select 1 from pg_type where typname = 'raw_asset_type')
            and not exists (
              select 1
              from pg_enum
              where enumlabel = 'video'
                and enumtypid = 'raw_asset_type'::regtype
            ) then
            alter type "raw_asset_type" add value 'video';
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'raw_asset_status') then
            create type "raw_asset_status" as enum ('new', 'normalized', 'failed');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'item_type') then
            create type "item_type" as enum ('article');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if exists (select 1 from pg_type where typname = 'item_type')
            and not exists (
              select 1
              from pg_enum
              where enumlabel = 'video'
                and enumtypid = 'item_type'::regtype
            ) then
            alter type "item_type" add value 'video';
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'item_status') then
            create type "item_status" as enum ('new', 'processed', 'archived');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'preserve_recommendation') then
            create type "preserve_recommendation" as enum ('keep', 'discard', 'review');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'item_group_type') then
            create type "item_group_type" as enum ('topic');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        create table if not exists "capture_entries" (
          "id" uuid primary key not null,
          "entry_type" "capture_entry_type" not null,
          "source_id" uuid,
          "trigger_ref" text,
          "status" "capture_entry_status" not null default 'captured',
          "metadata" jsonb not null default '{}'::jsonb,
          "captured_at" timestamp with time zone not null,
          "created_at" timestamp with time zone not null default now()
        )
      `);

      await transaction.unsafe(`
        create table if not exists "raw_assets" (
          "id" uuid primary key not null,
          "capture_entry_id" uuid not null,
          "asset_type" "raw_asset_type" not null,
          "external_id" text,
          "title" text,
          "author" text,
          "url" text,
          "published_at" timestamp with time zone,
          "raw_content" text,
          "raw_metadata" jsonb not null default '{}'::jsonb,
          "status" "raw_asset_status" not null default 'new',
          "created_at" timestamp with time zone not null default now(),
          "updated_at" timestamp with time zone not null default now()
        )
      `);

      await transaction.unsafe(`
        create table if not exists "items" (
          "id" uuid primary key not null,
          "raw_asset_id" uuid not null,
          "item_type" "item_type" not null,
          "title" text,
          "canonical_url" text,
          "author" text,
          "published_at" timestamp with time zone,
          "language" text,
          "content_text" text,
          "status" "item_status" not null default 'new',
          "metadata" jsonb not null default '{}'::jsonb,
          "created_at" timestamp with time zone not null default now(),
          "updated_at" timestamp with time zone not null default now()
        )
      `);

      await transaction.unsafe(`
        create table if not exists "enrichments" (
          "id" uuid primary key not null,
          "item_id" uuid not null,
          "importance_score" real,
          "novelty_score" real,
          "summary_short" text,
          "summary_long" text,
          "key_points" text[],
          "tags" text[],
          "topic" text,
          "classification" text,
          "why_it_matters" text,
          "preserve_recommendation" "preserve_recommendation",
          "note_draft" text,
          "ai_commentary" text,
          "dedupe_key" text,
          "is_current" boolean not null default true,
          "superseded_at" timestamp with time zone,
          "metadata" jsonb not null default '{}'::jsonb,
          "created_at" timestamp with time zone not null default now(),
          "updated_at" timestamp with time zone not null default now()
        )
      `);

      await transaction.unsafe(`
        alter table "enrichments"
        add column if not exists "why_it_matters" text
      `);

      await transaction.unsafe(`
        alter table "enrichments"
        add column if not exists "preserve_recommendation" "preserve_recommendation"
      `);

      await transaction.unsafe(`
        alter table "enrichments"
        add column if not exists "note_draft" text
      `);

      await transaction.unsafe(`
        alter table "enrichments"
        add column if not exists "is_current" boolean not null default true
      `);

      await transaction.unsafe(`
        alter table "enrichments"
        add column if not exists "superseded_at" timestamp with time zone
      `);

      await transaction.unsafe(`
        create table if not exists "item_groups" (
          "id" uuid primary key not null,
          "group_type" "item_group_type" not null,
          "title" text not null,
          "summary" text,
          "tag" text,
          "created_at" timestamp with time zone not null default now(),
          "updated_at" timestamp with time zone not null default now()
        )
      `);

      await transaction.unsafe(`
        create table if not exists "item_group_members" (
          "group_id" uuid not null,
          "item_id" uuid not null,
          constraint "item_group_members_pkey" primary key ("group_id", "item_id")
        )
      `);

      await transaction.unsafe(`
        create table if not exists "inbox_selections" (
          "id" uuid primary key not null,
          "item_id" uuid not null,
          "selected" boolean not null default false,
          "is_current" boolean not null default true,
          "relevance_score" real not null,
          "score_breakdown" jsonb not null default '{}'::jsonb,
          "selection_reasons" text[] not null default '{}'::text[],
          "policy_version" text not null,
          "metadata" jsonb not null default '{}'::jsonb,
          "created_at" timestamp with time zone not null default now(),
          "updated_at" timestamp with time zone not null default now()
        )
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (
            select 1 from pg_constraint where conname = 'capture_entries_source_id_sources_id_fk'
          ) then
            alter table "capture_entries"
            add constraint "capture_entries_source_id_sources_id_fk"
            foreign key ("source_id") references "public"."sources"("id") on delete set null;
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (
            select 1 from pg_constraint where conname = 'raw_assets_capture_entry_id_capture_entries_id_fk'
          ) then
            alter table "raw_assets"
            add constraint "raw_assets_capture_entry_id_capture_entries_id_fk"
            foreign key ("capture_entry_id") references "public"."capture_entries"("id") on delete cascade;
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (
            select 1 from pg_constraint where conname = 'items_raw_asset_id_raw_assets_id_fk'
          ) then
            alter table "items"
            add constraint "items_raw_asset_id_raw_assets_id_fk"
            foreign key ("raw_asset_id") references "public"."raw_assets"("id") on delete cascade;
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (
            select 1 from pg_constraint where conname = 'enrichments_item_id_items_id_fk'
          ) then
            alter table "enrichments"
            add constraint "enrichments_item_id_items_id_fk"
            foreign key ("item_id") references "public"."items"("id") on delete cascade;
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (
            select 1 from pg_constraint where conname = 'item_group_members_group_id_item_groups_id_fk'
          ) then
            alter table "item_group_members"
            add constraint "item_group_members_group_id_item_groups_id_fk"
            foreign key ("group_id") references "public"."item_groups"("id") on delete cascade;
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (
            select 1 from pg_constraint where conname = 'item_group_members_item_id_items_id_fk'
          ) then
            alter table "item_group_members"
            add constraint "item_group_members_item_id_items_id_fk"
            foreign key ("item_id") references "public"."items"("id") on delete cascade;
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (
            select 1 from pg_constraint where conname = 'inbox_selections_item_id_items_id_fk'
          ) then
            alter table "inbox_selections"
            add constraint "inbox_selections_item_id_items_id_fk"
            foreign key ("item_id") references "public"."items"("id") on delete cascade;
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        create index if not exists "capture_entries_source_id_idx"
        on "capture_entries" using btree ("source_id")
      `);

      await transaction.unsafe(`
        create index if not exists "capture_entries_status_idx"
        on "capture_entries" using btree ("status")
      `);

      await transaction.unsafe(`
        create index if not exists "capture_entries_captured_at_idx"
        on "capture_entries" using btree ("captured_at")
      `);

      await transaction.unsafe(`
        create index if not exists "raw_assets_capture_entry_id_idx"
        on "raw_assets" using btree ("capture_entry_id")
      `);

      await transaction.unsafe(`
        create index if not exists "raw_assets_status_idx"
        on "raw_assets" using btree ("status")
      `);

      await transaction.unsafe(`
        create index if not exists "raw_assets_url_idx"
        on "raw_assets" using btree ("url")
      `);

      await transaction.unsafe(`
        create index if not exists "raw_assets_published_at_idx"
        on "raw_assets" using btree ("published_at")
      `);

      await transaction.unsafe(`
        create unique index if not exists "items_raw_asset_id_key"
        on "items" using btree ("raw_asset_id")
      `);

      await transaction.unsafe(`
        create unique index if not exists "items_canonical_url_key"
        on "items" using btree ("canonical_url")
        where "canonical_url" is not null
      `);

      await transaction.unsafe(`
        create index if not exists "items_status_idx"
        on "items" using btree ("status")
      `);

      await transaction.unsafe(`
        create index if not exists "items_published_at_idx"
        on "items" using btree ("published_at")
      `);

      await transaction.unsafe(`
        drop index if exists "enrichments_item_id_key"
      `);

      await transaction.unsafe(`
        create unique index if not exists "enrichments_current_item_id_key"
        on "enrichments" using btree ("item_id")
        where "is_current" is true
      `);

      await transaction.unsafe(`
        create index if not exists "enrichments_dedupe_key_idx"
        on "enrichments" using btree ("dedupe_key")
      `);

      await transaction.unsafe(`
        create index if not exists "enrichments_topic_idx"
        on "enrichments" using btree ("topic")
      `);

      await transaction.unsafe(`
        create index if not exists "item_groups_group_type_idx"
        on "item_groups" using btree ("group_type")
      `);

      await transaction.unsafe(`
        create index if not exists "item_groups_tag_idx"
        on "item_groups" using btree ("tag")
      `);

      await transaction.unsafe(`
        create unique index if not exists "item_groups_group_type_tag_key"
        on "item_groups" using btree ("group_type", "tag")
      `);

      await transaction.unsafe(`
        create index if not exists "item_group_members_item_id_idx"
        on "item_group_members" using btree ("item_id")
      `);

      await transaction.unsafe(`
        create unique index if not exists "inbox_selections_current_item_id_key"
        on "inbox_selections" using btree ("item_id")
        where "is_current" is true
      `);

      await transaction.unsafe(`
        create index if not exists "inbox_selections_current_selected_idx"
        on "inbox_selections" using btree ("is_current", "selected")
      `);

      await transaction.unsafe(`
        create index if not exists "inbox_selections_relevance_score_idx"
        on "inbox_selections" using btree ("relevance_score")
      `);
    });
  } finally {
    await client.end();
  }
}
