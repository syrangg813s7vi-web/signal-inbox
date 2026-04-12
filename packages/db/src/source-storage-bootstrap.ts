import { createSqlClient } from "./client";

export async function bootstrapSourceStorageSchema(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set before bootstrapping source storage.");
  }

  const client = createSqlClient(databaseUrl);

  try {
    await client.begin(async (transaction) => {
      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'source_type') then
            create type "source_type" as enum ('rss');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_type where typname = 'source_status') then
            create type "source_status" as enum ('active', 'paused', 'error');
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        create table if not exists "sources" (
          "id" uuid primary key not null,
          "name" text not null,
          "source_type" "source_type" not null,
          "source_ref" text not null,
          "source_url" text,
          "status" "source_status" not null default 'active',
          "topic" text,
          "metadata" jsonb not null default '{}'::jsonb,
          "created_at" timestamp with time zone not null default now(),
          "updated_at" timestamp with time zone not null default now()
        )
      `);

      await transaction.unsafe(`
        create table if not exists "source_sync_state" (
          "source_id" uuid primary key not null,
          "cursor" text,
          "last_synced_at" timestamp with time zone,
          "last_success_at" timestamp with time zone,
          "last_error_at" timestamp with time zone,
          "last_error_message" text
        )
      `);

      await transaction.unsafe(`
        do $$
        begin
          if not exists (
            select 1
            from pg_constraint
            where conname = 'source_sync_state_source_id_sources_id_fk'
          ) then
            alter table "source_sync_state"
            add constraint "source_sync_state_source_id_sources_id_fk"
            foreign key ("source_id") references "public"."sources"("id") on delete cascade;
          end if;
        end
        $$;
      `);

      await transaction.unsafe(`
        create unique index if not exists "sources_source_type_source_ref_key"
        on "sources" using btree ("source_type", "source_ref")
      `);

      await transaction.unsafe(`
        create index if not exists "sources_status_idx"
        on "sources" using btree ("status")
      `);

      await transaction.unsafe(`
        create index if not exists "sources_topic_idx"
        on "sources" using btree ("topic")
      `);
    });
  } finally {
    await client.end();
  }
}
