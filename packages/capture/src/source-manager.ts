import { and, desc, eq } from "drizzle-orm";

import { createDbFromClient, createSqlClient, sourceSyncState, sources } from "@signal-inbox/db";

export type SourceStatus = "active" | "paused" | "error";

export interface SourceSyncStateRecord {
  cursor: string | null;
  lastSyncedAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
}

export interface RssSourceRecord {
  id: string;
  name: string;
  sourceType: "rss";
  sourceRef: string;
  sourceUrl: string | null;
  status: SourceStatus;
  topic: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  syncState: SourceSyncStateRecord | null;
}

export interface CreateRssSourceInput {
  name: string;
  sourceUrl: string;
  topic?: string | null;
}

type PostgresErrorLike = Error & {
  cause?: unknown;
  code?: string;
  constraint?: string;
  constraint_name?: string;
};

export class SourceValidationError extends Error {}
export class SourceConflictError extends Error {}
export class SourceNotFoundError extends Error {}

export async function listRssSources(databaseUrl?: string): Promise<RssSourceRecord[]> {
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);

  try {
    await backfillMissingSyncStateRows(client);

    const rows = await db
      .select(sourceSelection)
      .from(sources)
      .leftJoin(sourceSyncState, eq(sourceSyncState.sourceId, sources.id))
      .where(eq(sources.sourceType, "rss"))
      .orderBy(desc(sources.createdAt), desc(sources.updatedAt));

    return rows.map(mapSourceRow);
  } finally {
    await client.end();
  }
}

export async function createRssSource(
  input: CreateRssSourceInput,
  databaseUrl?: string,
): Promise<RssSourceRecord> {
  const validatedInput = validateCreateInput(input);
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const now = new Date();

  try {
    const createdSource = await db.transaction(async (tx) => {
      const [source] = await tx
        .insert(sources)
        .values({
          name: validatedInput.name,
          sourceRef: buildSourceRef(validatedInput.sourceUrl),
          sourceType: "rss",
          sourceUrl: validatedInput.sourceUrl,
          status: "active",
          topic: validatedInput.topic,
          updatedAt: now,
        })
        .returning();

      await tx.insert(sourceSyncState).values({
        sourceId: source.id,
      });

      return source;
    });

    return {
      ...createdSource,
      syncState: {
        cursor: null,
        lastSyncedAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    };
  } catch (error) {
    const postgresError = unwrapPostgresError(error);

    if (
      postgresError.code === "23505" &&
      (postgresError.constraint_name ?? postgresError.constraint) ===
        "sources_source_type_source_ref_key"
    ) {
      throw new SourceConflictError("That RSS source is already registered.");
    }

    throw error;
  } finally {
    await client.end();
  }
}

export async function pauseSource(sourceId: string, databaseUrl?: string): Promise<RssSourceRecord> {
  return updateSourceStatus(sourceId, "paused", databaseUrl);
}

export async function reactivateSource(
  sourceId: string,
  databaseUrl?: string,
): Promise<RssSourceRecord> {
  return updateSourceStatus(sourceId, "active", databaseUrl);
}

export async function getRssSource(sourceId: string, databaseUrl?: string): Promise<RssSourceRecord | null> {
  if (!sourceId.trim()) {
    throw new SourceValidationError("Source id is required.");
  }

  return getRssSourceById(sourceId, databaseUrl);
}

export async function deleteSource(sourceId: string, databaseUrl?: string): Promise<void> {
  if (!sourceId.trim()) {
    throw new SourceValidationError("Source id is required.");
  }

  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);

  try {
    const [deletedSource] = await db
      .delete(sources)
      .where(and(eq(sources.id, sourceId), eq(sources.sourceType, "rss")))
      .returning({ id: sources.id });

    if (!deletedSource) {
      throw new SourceNotFoundError("Source not found.");
    }
  } finally {
    await client.end();
  }
}

async function updateSourceStatus(
  sourceId: string,
  status: SourceStatus,
  databaseUrl?: string,
): Promise<RssSourceRecord> {
  if (!sourceId.trim()) {
    throw new SourceValidationError("Source id is required.");
  }

  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const now = new Date();

  try {
    await ensureSourceSyncStateRow(client, sourceId);

    const [updatedSource] = await db
      .update(sources)
      .set({
        status,
        updatedAt: now,
      })
      .where(and(eq(sources.id, sourceId), eq(sources.sourceType, "rss")))
      .returning();

    if (!updatedSource) {
      throw new SourceNotFoundError("Source not found.");
    }

    const source = await getRssSourceById(sourceId, databaseUrl);

    if (!source) {
      throw new SourceNotFoundError("Source not found.");
    }

    return source;
  } finally {
    await client.end();
  }
}

function validateCreateInput(input: CreateRssSourceInput): Required<CreateRssSourceInput> {
  const name = input.name.trim();
  const sourceUrl = normalizeSourceUrl(input.sourceUrl);
  const topic = input.topic?.trim() ?? "";

  if (!name) {
    throw new SourceValidationError("Source name is required.");
  }

  return {
    name,
    sourceUrl,
    topic: topic || null,
  };
}

function normalizeSourceUrl(sourceUrl: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(sourceUrl.trim());
  } catch {
    throw new SourceValidationError("Enter a valid RSS URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new SourceValidationError("RSS URLs must use http or https.");
  }

  parsedUrl.hash = "";
  return parsedUrl.toString();
}

function buildSourceRef(sourceUrl: string): string {
  return sourceUrl;
}

async function backfillMissingSyncStateRows(client: ReturnType<typeof createSqlClient>) {
  await client`
    insert into "source_sync_state" ("source_id")
    select "sources"."id"
    from "sources"
    left join "source_sync_state"
      on "source_sync_state"."source_id" = "sources"."id"
    where "sources"."source_type" = 'rss'
      and "source_sync_state"."source_id" is null
    on conflict ("source_id") do nothing
  `;
}

async function ensureSourceSyncStateRow(
  client: ReturnType<typeof createSqlClient>,
  sourceId: string,
) {
  await client`
    insert into "source_sync_state" ("source_id")
    select "sources"."id"
    from "sources"
    where "sources"."id" = ${sourceId}
      and "sources"."source_type" = 'rss'
    on conflict ("source_id") do nothing
  `;
}

const sourceSelection = {
  id: sources.id,
  name: sources.name,
  sourceType: sources.sourceType,
  sourceRef: sources.sourceRef,
  sourceUrl: sources.sourceUrl,
  status: sources.status,
  topic: sources.topic,
  metadata: sources.metadata,
  createdAt: sources.createdAt,
  updatedAt: sources.updatedAt,
  syncSourceId: sourceSyncState.sourceId,
  syncCursor: sourceSyncState.cursor,
  syncLastSyncedAt: sourceSyncState.lastSyncedAt,
  syncLastSuccessAt: sourceSyncState.lastSuccessAt,
  syncLastErrorAt: sourceSyncState.lastErrorAt,
  syncLastErrorMessage: sourceSyncState.lastErrorMessage,
};

interface SourceRow {
  id: string;
  name: string;
  sourceType: "rss";
  sourceRef: string;
  sourceUrl: string | null;
  status: SourceStatus;
  topic: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  syncSourceId: string | null;
  syncCursor: string | null;
  syncLastSyncedAt: Date | null;
  syncLastSuccessAt: Date | null;
  syncLastErrorAt: Date | null;
  syncLastErrorMessage: string | null;
}

async function getRssSourceById(sourceId: string, databaseUrl?: string): Promise<RssSourceRecord | null> {
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);

  try {
    const [row] = await db
      .select(sourceSelection)
      .from(sources)
      .leftJoin(sourceSyncState, eq(sourceSyncState.sourceId, sources.id))
      .where(and(eq(sources.id, sourceId), eq(sources.sourceType, "rss")));

    return row ? mapSourceRow(row) : null;
  } finally {
    await client.end();
  }
}

function mapSourceRow(row: SourceRow): RssSourceRecord {
  return {
    id: row.id,
    name: row.name,
    sourceType: row.sourceType,
    sourceRef: row.sourceRef,
    sourceUrl: row.sourceUrl,
    status: row.status,
    topic: row.topic,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    syncState:
      row.syncSourceId !== null
        ? {
            cursor: row.syncCursor,
            lastSyncedAt: row.syncLastSyncedAt,
            lastSuccessAt: row.syncLastSuccessAt,
            lastErrorAt: row.syncLastErrorAt,
            lastErrorMessage: row.syncLastErrorMessage,
          }
        : null,
  };
}

function unwrapPostgresError(error: unknown): PostgresErrorLike {
  let current = error;

  while (current && typeof current === "object") {
    const postgresError = current as PostgresErrorLike;

    if (postgresError.code || postgresError.constraint || postgresError.constraint_name) {
      return postgresError;
    }

    current = postgresError.cause;
  }

  return (error as PostgresErrorLike) ?? new Error("Unknown PostgreSQL error.");
}
