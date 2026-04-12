import path from "node:path";
import { fileURLToPath } from "node:url";

import type { MigrationConfig } from "drizzle-orm/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

import { createSqlClient } from "./client";

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");

export interface RunMigrationsOptions extends Omit<MigrationConfig, "migrationsFolder"> {}

type SqlExecutor = Pick<ReturnType<typeof createSqlClient>, "unsafe">;

export async function runMigrations(
  databaseUrl = process.env.DATABASE_URL,
  options: RunMigrationsOptions = {},
) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set before running db migrations.");
  }

  const client = createSqlClient(databaseUrl);
  const migrationsSchema = options.migrationsSchema ?? "drizzle";
  const migrationsTable = options.migrationsTable ?? "__drizzle_migrations";
  const migrations = readMigrationFiles({
    migrationsFolder,
  });

  try {
    await ensureMigrationsSchema(client, migrationsSchema);
    await ensureMigrationsTable(client, migrationsSchema, migrationsTable);

    const lastMigration = await readLastMigration(client, migrationsSchema, migrationsTable);

    await client.begin(async (transaction) => {
      for (const migration of migrations) {
        if (lastMigration && Number(lastMigration.created_at) >= migration.folderMillis) {
          continue;
        }

        for (const statement of migration.sql) {
          await executeMigrationStatement(transaction, statement);
        }

        await transaction.unsafe(
          `insert into ${qualifiedName(migrationsSchema, migrationsTable)} ("hash", "created_at") values ($1, $2)`,
          [migration.hash, migration.folderMillis],
        );
      }
    });
  } finally {
    await client.end();
  }
}

async function ensureMigrationsSchema(client: ReturnType<typeof createSqlClient>, schemaName: string) {
  const [row] = await client.unsafe<{ exists: boolean }[]>(
    "select exists (select 1 from information_schema.schemata where schema_name = $1) as exists",
    [schemaName],
  );

  if (row?.exists) {
    return;
  }

  await client.unsafe(`create schema if not exists ${quotedIdentifier(schemaName)}`);
}

async function ensureMigrationsTable(
  client: ReturnType<typeof createSqlClient>,
  schemaName: string,
  tableName: string,
) {
  await client.unsafe(`
    create table if not exists ${qualifiedName(schemaName, tableName)} (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `);
}

async function readLastMigration(
  client: ReturnType<typeof createSqlClient>,
  schemaName: string,
  tableName: string,
) {
  const rows = await client.unsafe<Array<{ id: number; hash: string; created_at: number | string }>>(
    `select id, hash, created_at from ${qualifiedName(schemaName, tableName)} order by created_at desc limit 1`,
  );

  return rows[0];
}

async function executeMigrationStatement(client: SqlExecutor, statement: string) {
  if (await shouldSkipBootstrapCompatibleStatement(client, statement)) {
    return;
  }

  try {
    await client.unsafe(statement);
  } catch (error) {
    if (!(await canSkipMigrationStatementError(client, statement, error))) {
      throw error;
    }
  }
}

async function canSkipMigrationStatementError(
  client: SqlExecutor,
  statement: string,
  error: unknown,
) {
  if (canSkipDuplicateBootstrapObjectError(statement, error)) {
    return true;
  }

  if (!isPgcryptoExtensionStatement(statement)) {
    return false;
  }

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : null;

  if (code !== "42501") {
    return false;
  }

  return hasGenRandomUuidFunction(client);
}

function canSkipDuplicateBootstrapObjectError(statement: string, error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : null;

  if (code !== "42P07" && code !== "42710") {
    return false;
  }

  const normalizedStatement = statement.replace(/\s+/g, " ").trim().toLowerCase();

  return (
    normalizedStatement.includes('create type "public"."source_status"') ||
    normalizedStatement.includes('create type "public"."source_type"') ||
    normalizedStatement.includes('create table "source_sync_state"') ||
    normalizedStatement.includes('create table "sources"') ||
    normalizedStatement.includes(
      'alter table "source_sync_state" add constraint "source_sync_state_source_id_sources_id_fk"',
    ) ||
    normalizedStatement.includes('create unique index "sources_source_type_source_ref_key"') ||
    normalizedStatement.includes('create index "sources_status_idx"') ||
    normalizedStatement.includes('create index "sources_topic_idx"')
  );
}

async function shouldSkipBootstrapCompatibleStatement(client: SqlExecutor, statement: string) {
  const normalizedStatement = statement.replace(/\s+/g, " ").trim().toLowerCase();

  if (normalizedStatement.includes('create type "public"."source_status"')) {
    return await typeExists(client, "source_status");
  }

  if (normalizedStatement.includes('create type "public"."source_type"')) {
    return await typeExists(client, "source_type");
  }

  if (normalizedStatement.includes('create table "source_sync_state"')) {
    return await relationExists(client, "public.source_sync_state");
  }

  if (normalizedStatement.includes('create table "sources"')) {
    return await relationExists(client, "public.sources");
  }

  if (
    normalizedStatement.includes(
      'alter table "source_sync_state" add constraint "source_sync_state_source_id_sources_id_fk"',
    )
  ) {
    return await constraintExists(client, "source_sync_state_source_id_sources_id_fk");
  }

  if (normalizedStatement.includes('create unique index "sources_source_type_source_ref_key"')) {
    return await relationExists(client, "public.sources_source_type_source_ref_key");
  }

  if (normalizedStatement.includes('create index "sources_status_idx"')) {
    return await relationExists(client, "public.sources_status_idx");
  }

  if (normalizedStatement.includes('create index "sources_topic_idx"')) {
    return await relationExists(client, "public.sources_topic_idx");
  }

  return false;
}

async function typeExists(client: SqlExecutor, typeName: string) {
  const [row] = await client.unsafe<Array<{ exists: boolean }>>(
    "select exists (select 1 from pg_type where typname = $1) as exists",
    [typeName],
  );

  return row?.exists ?? false;
}

async function relationExists(client: SqlExecutor, relationName: string) {
  const [row] = await client.unsafe<Array<{ exists: boolean }>>(
    "select to_regclass($1) is not null as exists",
    [relationName],
  );

  return row?.exists ?? false;
}

async function constraintExists(client: SqlExecutor, constraintName: string) {
  const [row] = await client.unsafe<Array<{ exists: boolean }>>(
    "select exists (select 1 from pg_constraint where conname = $1) as exists",
    [constraintName],
  );

  return row?.exists ?? false;
}

async function hasGenRandomUuidFunction(client: SqlExecutor) {
  const [row] = await client.unsafe<Array<{ exists: boolean }>>(
    "select to_regproc('gen_random_uuid') is not null as exists",
  );

  return row?.exists ?? false;
}

function isPgcryptoExtensionStatement(statement: string) {
  return /^create extension if not exists "pgcrypto";?$/i.test(statement.trim());
}

function qualifiedName(schemaName: string, tableName: string) {
  return `${quotedIdentifier(schemaName)}.${quotedIdentifier(tableName)}`;
}

function quotedIdentifier(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}

async function main() {
  await runMigrations();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
