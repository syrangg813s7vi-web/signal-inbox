import { createSqlClient } from "./client";
import { bootstrapInboxStorageSchema } from "./inbox-storage-bootstrap";

export async function bootstrapKnowledgeStorageSchema(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set before bootstrapping knowledge storage.");
  }

  await bootstrapInboxStorageSchema(databaseUrl);

  const client = createSqlClient(databaseUrl);

  try {
    await client.begin(async (transaction) => {
      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'note_type') then
            create type "note_type" as enum ('reference', 'summary');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'knowledge_destination_type') then
            create type "knowledge_destination_type" as enum ('notion', 'obsidian');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'knowledge_destination_status') then
            create type "knowledge_destination_status" as enum ('active', 'disabled', 'error');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        create table if not exists "notes" (
          "id" uuid primary key not null,
          "item_id" uuid not null,
          "note_type" "note_type" not null,
          "title" text not null,
          "body_md" text not null,
          "highlights" text[] not null default '{}'::text[],
          "tags" text[] not null default '{}'::text[],
          "review_weight" real,
          "metadata" jsonb not null default '{}'::jsonb,
          "created_at" timestamp with time zone not null default now(),
          "updated_at" timestamp with time zone not null default now()
        )
      `);

      await transaction.unsafe(`
        create table if not exists "knowledge_destinations" (
          "id" uuid primary key not null,
          "destination_type" "knowledge_destination_type" not null,
          "name" text not null,
          "target_ref" text not null,
          "status" "knowledge_destination_status" not null default 'active',
          "metadata" jsonb not null default '{}'::jsonb,
          "created_at" timestamp with time zone not null default now(),
          "updated_at" timestamp with time zone not null default now()
        )
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (
            select 1 from pg_constraint where conname = 'notes_item_id_items_id_fk'
          ) then
            alter table "notes"
            add constraint "notes_item_id_items_id_fk"
            foreign key ("item_id") references "public"."items"("id") on delete cascade;
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        create unique index if not exists "notes_item_id_key"
        on "notes" using btree ("item_id")
      `);

      await transaction.unsafe(`
        create index if not exists "notes_note_type_idx"
        on "notes" using btree ("note_type")
      `);

      await transaction.unsafe(`
        create index if not exists "notes_created_at_idx"
        on "notes" using btree ("created_at")
      `);

      await transaction.unsafe(`
        create unique index if not exists "knowledge_destinations_type_target_ref_key"
        on "knowledge_destinations" using btree ("destination_type", "target_ref")
      `);

      await transaction.unsafe(`
        create index if not exists "knowledge_destinations_status_idx"
        on "knowledge_destinations" using btree ("status")
      `);
    });
  } finally {
    await client.end();
  }
}
