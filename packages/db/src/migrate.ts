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
  if (await canSkipBootstrapCompatibleObjectError(client, statement, error)) {
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

async function canSkipBootstrapCompatibleObjectError(
  client: SqlExecutor,
  statement: string,
  error: unknown,
) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : null;

  if (code === "42P07" || code === "42710" || code === "42701") {
    return shouldSkipBootstrapCompatibleStatement(client, statement);
  }

  if (code === "42704") {
    const dropIndexName = extractDropIndexName(statement);

    if (dropIndexName) {
      return !(await relationExists(client, `public.${dropIndexName}`));
    }
  }

  return false;
}

async function shouldSkipBootstrapCompatibleStatement(client: SqlExecutor, statement: string) {
  const typeName = extractCreatedTypeName(statement);

  if (typeName) {
    return await typeExists(client, typeName);
  }

  const tableName = extractCreatedTableName(statement);

  if (tableName) {
    return await relationExists(client, `public.${tableName}`);
  }

  const constraintName = extractAddedConstraintName(statement);

  if (constraintName) {
    return await constraintExists(client, constraintName);
  }

  const indexName = extractCreatedIndexName(statement);

  if (indexName) {
    return await relationExists(client, `public.${indexName}`);
  }

  const addedColumn = extractAddedColumn(statement);

  if (addedColumn) {
    return await columnExists(client, addedColumn.tableName, addedColumn.columnName);
  }

  const dropIndexName = extractDropIndexName(statement);

  if (dropIndexName) {
    return !(await relationExists(client, `public.${dropIndexName}`));
  }

  return false;
}

function extractCreatedTypeName(statement: string) {
  return statement.match(/create type "public"\."([^"]+)"/i)?.[1] ?? null;
}

function extractCreatedTableName(statement: string) {
  return statement.match(/create table "([^"]+)"/i)?.[1] ?? null;
}

function extractAddedConstraintName(statement: string) {
  return statement.match(/add constraint "([^"]+)"/i)?.[1] ?? null;
}

function extractCreatedIndexName(statement: string) {
  return statement.match(/create(?: unique)? index "([^"]+)"/i)?.[1] ?? null;
}

function extractDropIndexName(statement: string) {
  return statement.match(/drop index "([^"]+)"/i)?.[1] ?? null;
}

function extractAddedColumn(statement: string) {
  const match = statement.match(/alter table "([^"]+)" add column "([^"]+)"/i);

  if (!match) {
    return null;
  }

  return {
    columnName: match[2],
    tableName: match[1],
  };
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

async function columnExists(client: SqlExecutor, tableName: string, columnName: string) {
  const [row] = await client.unsafe<Array<{ exists: boolean }>>(
    `
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = $1
          and column_name = $2
      ) as exists
    `,
    [tableName, columnName],
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
