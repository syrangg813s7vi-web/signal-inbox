import path from "node:path";
import { fileURLToPath } from "node:url";

import type { MigrationConfig } from "drizzle-orm/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

import { createSqlClient } from "./client";

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");

export interface RunMigrationsOptions extends Omit<MigrationConfig, "migrationsFolder"> {}

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
          await transaction.unsafe(statement);
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
