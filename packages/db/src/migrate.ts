import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDbFromClient, createSqlClient } from "./client";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export async function runMigrations(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set before running db migrations.");
  }

  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);

  try {
    await migrate(db, {
      migrationsFolder,
    });
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runMigrations();
}
