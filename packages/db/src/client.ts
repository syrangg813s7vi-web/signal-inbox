import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema";

export type SignalInboxDatabase = ReturnType<typeof createDb>;

const DATABASE_URL_ENV_NAME = "DATABASE_URL";

export function getDatabaseUrl(): string {
  const databaseUrl = process.env[DATABASE_URL_ENV_NAME];

  if (!databaseUrl) {
    throw new Error(`${DATABASE_URL_ENV_NAME} must be set to use @signal-inbox/db.`);
  }

  return databaseUrl;
}

export function createSqlClient(
  databaseUrl = getDatabaseUrl(),
  options: Parameters<typeof postgres>[1] = {},
): Sql {
  return postgres(databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 5,
    max: 1,
    prepare: false,
    ...options,
  });
}

export function createDbFromClient(client: Sql) {
  return drizzle(client, {
    schema,
  });
}

export function createDb(databaseUrl = getDatabaseUrl()) {
  return createDbFromClient(createSqlClient(databaseUrl));
}
