import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import {
  bootstrapSourceStorageSchema,
  captureEntries,
  createDbFromClient,
  createSqlClient,
  enrichments,
  itemGroupMembers,
  itemGroups,
  items,
  rawAssets,
  sourceSyncState,
  sources,
} from "./index";
import { runMigrations } from "./migrate";
import { startTemporaryPostgres } from "./testing";

type PostgresErrorLike = Error & {
  cause?: unknown;
  code?: string;
  constraint?: string;
  constraint_name?: string;
};

async function main() {
  const tempInstance = process.env.DATABASE_URL ? null : await startTemporaryPostgres();
  const databaseUrl = tempInstance?.databaseUrl ?? process.env.DATABASE_URL;
  const compatibilityTempInstance = process.env.DATABASE_URL ? null : await startTemporaryPostgres();
  const compatibilityDatabaseUrl = compatibilityTempInstance?.databaseUrl ?? process.env.DATABASE_URL;

  assert.ok(databaseUrl, "DATABASE_URL must be set or a temporary PostgreSQL instance must start.");
  assert.ok(
    compatibilityDatabaseUrl,
    "DATABASE_URL must be set or a temporary PostgreSQL instance must start.",
  );

  process.env.DATABASE_URL = databaseUrl;

  try {
    await runMigrations(databaseUrl);
    await runSmokeTest(databaseUrl);
    await runBootstrapCompatibilitySmokeTest(compatibilityDatabaseUrl);
    console.log("Database smoke test passed.");
  } finally {
    await tempInstance?.cleanup();
    await compatibilityTempInstance?.cleanup();
  }
}

async function runSmokeTest(databaseUrl: string) {
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const capturedAt = new Date("2026-04-12T00:00:00.000Z");
  const runId = randomUUID();
  const sourceRef = `rss:ai-feed:${runId}`;
  const articleUrl = `https://example.com/articles/${runId}`;

  try {
    const [source] = await db
      .insert(sources)
      .values({
        name: "AI Feed",
        sourceRef,
        sourceType: "rss",
        sourceUrl: "https://example.com/feed.xml",
        topic: "AI",
      })
      .returning({ id: sources.id });

    const [captureEntry] = await db
      .insert(captureEntries)
      .values({
        capturedAt,
        entryType: "source_sync",
        sourceId: source.id,
        triggerRef: "entry-001",
      })
      .returning({ id: captureEntries.id, sourceId: captureEntries.sourceId });

    const [rawAsset] = await db
      .insert(rawAssets)
      .values({
        assetType: "article",
        author: "Signal Inbox",
        captureEntryId: captureEntry.id,
        publishedAt: capturedAt,
        rawContent: "raw article content",
        title: "A useful article",
        url: articleUrl,
      })
      .returning({ captureEntryId: rawAssets.captureEntryId, id: rawAssets.id });

    const [item] = await db
      .insert(items)
      .values({
        canonicalUrl: articleUrl,
        contentText: "normalized article content",
        itemType: "article",
        publishedAt: capturedAt,
        rawAssetId: rawAsset.id,
        title: "A useful article",
      })
      .returning({ id: items.id, rawAssetId: items.rawAssetId });

    const [enrichment] = await db
      .insert(enrichments)
      .values({
        classification: "research",
        importanceScore: 0.9,
        itemId: item.id,
        noveltyScore: 0.6,
        summaryShort: "Short summary",
        topic: "AI",
      })
      .returning({ id: enrichments.id, itemId: enrichments.itemId });

    const [itemGroup] = await db
      .insert(itemGroups)
      .values({
        groupType: "topic",
        summary: "Grouped AI items",
        tag: "ai",
        title: "AI topic",
      })
      .returning({ id: itemGroups.id });

    const [member] = await db
      .insert(itemGroupMembers)
      .values({
        groupId: itemGroup.id,
        itemId: item.id,
      })
      .returning({ groupId: itemGroupMembers.groupId, itemId: itemGroupMembers.itemId });

    assert.equal(captureEntry.sourceId, source.id);
    assert.equal(rawAsset.captureEntryId, captureEntry.id);
    assert.equal(item.rawAssetId, rawAsset.id);
    assert.equal(enrichment.itemId, item.id);
    assert.equal(member.groupId, itemGroup.id);
    assert.equal(member.itemId, item.id);

    await expectPostgresError(
      () =>
        db.insert(sources).values({
          name: "Duplicate AI Feed",
          sourceRef,
          sourceType: "rss",
        }),
      "23505",
      "sources_source_type_source_ref_key",
    );

    await expectPostgresError(
      () =>
        db.insert(rawAssets).values({
          assetType: "article",
          captureEntryId: randomUUID(),
        }),
      "23503",
      "raw_assets_capture_entry_id_capture_entries_id_fk",
    );
  } finally {
    await client.end();
  }
}

async function expectPostgresError(
  operation: () => Promise<unknown>,
  expectedCode: string,
  expectedConstraint: string,
) {
  try {
    await operation();
  } catch (error) {
    const postgresError = unwrapPostgresError(error);

    assert.equal(postgresError.code, expectedCode);
    assert.equal(postgresError.constraint_name ?? postgresError.constraint, expectedConstraint);
    return;
  }

  assert.fail(`Expected PostgreSQL error ${expectedCode} for ${expectedConstraint}.`);
}

async function runBootstrapCompatibilitySmokeTest(databaseUrl: string) {
  const bootstrapClient = createSqlClient(databaseUrl);
  const bootstrapDb = createDbFromClient(bootstrapClient);
  const bootstrapSourceId = randomUUID();
  const bootstrapSourceRef = `rss:bootstrap:${randomUUID()}`;

  await bootstrapSourceStorageSchema(databaseUrl);

  try {
    await bootstrapDb.insert(sources).values({
      id: bootstrapSourceId,
      name: "Bootstrap Feed",
      sourceRef: bootstrapSourceRef,
      sourceType: "rss",
      sourceUrl: "https://example.com/bootstrap.xml",
      topic: "Bootstrap",
    });

    await bootstrapDb.insert(sourceSyncState).values({
      sourceId: bootstrapSourceId,
    });
  } finally {
    await bootstrapClient.end();
  }

  await runMigrations(databaseUrl);

  const migratedClient = createSqlClient(databaseUrl);
  const migratedDb = createDbFromClient(migratedClient);

  try {
    const [migratedSource] = await migratedDb
      .select({ id: sources.id, sourceRef: sources.sourceRef })
      .from(sources)
      .where(eq(sources.id, bootstrapSourceId));

    const [migratedSyncState] = await migratedDb
      .select({ sourceId: sourceSyncState.sourceId })
      .from(sourceSyncState)
      .where(eq(sourceSyncState.sourceId, bootstrapSourceId));

    assert.equal(migratedSource?.sourceRef, bootstrapSourceRef);
    assert.equal(migratedSyncState?.sourceId, bootstrapSourceId);
  } finally {
    await migratedClient.end();
  }

  await runSmokeTest(databaseUrl);
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
await main();
