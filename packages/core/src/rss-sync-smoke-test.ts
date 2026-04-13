import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { desc, eq } from "drizzle-orm";

import { createRssSource, getRssSource } from "@signal-inbox/capture";
import {
  captureEntries,
  createDbFromClient,
  createSqlClient,
  items,
  rawAssets,
  runMigrations,
  sourceSyncState,
  startTemporaryPostgres,
} from "@signal-inbox/db";

import { runNormalizeRawAssetJob } from "./normalize-raw-asset-job";
import { runRssSourceSyncJob, SourceSyncJobError } from "./capture-sync-job";

interface CaptureEntryMetadata {
  fetchedCount?: number;
  normalization?: {
    phase?: string;
    reason?: string;
  };
  persistedCount?: number;
  phase?: string;
  skippedCount?: number;
}

interface ItemMetadata {
  canonicalUrlConflict?: string;
  connectorType?: string;
  rss?: {
    feedLanguage?: string;
    feedTitle?: string;
    feedUrl?: string;
  };
}

async function main() {
  const temporaryPostgres = process.env.DATABASE_URL ? null : await startTemporaryPostgres();
  const databaseUrl = temporaryPostgres?.databaseUrl ?? process.env.DATABASE_URL;

  assert.ok(databaseUrl, "DATABASE_URL must be set or a temporary PostgreSQL instance must start.");

  const feedState = {
    mode: "success" as "success" | "failure",
    xml: buildRssFeed([
      {
        description:
          "<p>First <strong>article</strong> description &amp; details.</p><p>Second paragraph.</p>",
        guid: "entry-1",
        link: "https://example.com/articles/1",
        pubDate: "Sat, 12 Apr 2026 10:00:00 GMT",
        title: "First article",
      },
      {
        description: "Second article description",
        guid: "entry-2",
        link: "https://example.com/articles/2",
        pubDate: "Sat, 12 Apr 2026 09:00:00 GMT",
        title: "Second article",
      },
    ]),
  };
  const server = createServer((request, response) => {
    if (request.url !== "/feed.xml" && request.url !== "/feed-duplicate.xml") {
      response.writeHead(404).end();
      return;
    }

    if (feedState.mode === "failure") {
      response.writeHead(500, { "content-type": "text/plain" }).end("failure");
      return;
    }

    response.writeHead(200, { "content-type": "application/rss+xml" }).end(feedState.xml);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const sourceUrl = `http://127.0.0.1:${address.port}/feed.xml`;
  const duplicateSourceUrl = `http://127.0.0.1:${address.port}/feed-duplicate.xml`;

  try {
    await runMigrations(databaseUrl);
    await runSmokeTest(databaseUrl, sourceUrl, duplicateSourceUrl, feedState);
    console.log("RSS source sync smoke test passed.");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await temporaryPostgres?.cleanup();
  }
}

async function runSmokeTest(
  databaseUrl: string,
  sourceUrl: string,
  duplicateSourceUrl: string,
  feedState: {
    mode: "success" | "failure";
    xml: string;
  },
) {
  const createdSource = await createRssSource(
    {
      name: "RSS Sync Feed",
      sourceUrl,
      topic: "AI",
    },
    databaseUrl,
  );

  const firstResult = await runRssSourceSyncJob(
    {
      databaseUrl,
      sourceId: createdSource.id,
      triggerRef: `smoke-first-${randomUUID()}`,
    },
  );

  assert.equal(firstResult.fetchedCount, 2);
  assert.equal(firstResult.persistedCount, 2);
  assert.equal(firstResult.skippedCount, 0);
  assert.equal(firstResult.normalizedItemIds.length, 2);

  let dbClient: ReturnType<typeof createSqlClient>;
  let db: ReturnType<typeof createDbFromClient>;

  const repeatedNormalizationResult = await runNormalizeRawAssetJob({
    databaseUrl,
    rawAssetId: firstResult.rawAssetIds[0]!,
  });

  assert.equal(repeatedNormalizationResult.rawAssetId, firstResult.rawAssetIds[0]);
  assert.equal(repeatedNormalizationResult.itemId, firstResult.normalizedItemIds[0]);

  dbClient = createSqlClient(databaseUrl);
  db = createDbFromClient(dbClient);

  try {
    const [concurrentCaptureEntry] = await db
      .insert(captureEntries)
      .values({
        capturedAt: new Date("2026-04-12T10:45:00.000Z"),
        entryType: "source_sync",
        metadata: {
          connectorType: "rss",
          phase: "completed",
        },
        sourceId: createdSource.id,
        triggerRef: `smoke-concurrent-${randomUUID()}`,
      })
      .returning({ id: captureEntries.id });

    const [concurrentRawAsset] = await db
      .insert(rawAssets)
      .values({
        assetType: "article",
        captureEntryId: concurrentCaptureEntry.id,
        externalId: `concurrent-${randomUUID()}`,
        publishedAt: new Date("2026-04-12T10:45:00.000Z"),
        rawContent: "<p>Concurrent normalization body.</p>",
        rawMetadata: {
          connectorType: "rss",
          feed: {
            language: "en",
            siteUrl: "https://example.com/feed",
            title: "Signal Inbox Feed",
          },
          sourceUrl,
        },
        title: "Concurrent normalization article",
        url: `https://example.com/articles/concurrent-${randomUUID()}`,
      })
      .returning({ id: rawAssets.id });

    const concurrentResults = await Promise.all([
      runNormalizeRawAssetJob({
        databaseUrl,
        rawAssetId: concurrentRawAsset.id,
      }),
      runNormalizeRawAssetJob({
        databaseUrl,
        rawAssetId: concurrentRawAsset.id,
      }),
    ]);

    assert.equal(concurrentResults[0]?.rawAssetId, concurrentRawAsset.id);
    assert.equal(concurrentResults[1]?.rawAssetId, concurrentRawAsset.id);
    assert.equal(concurrentResults[0]?.itemId, concurrentResults[1]?.itemId);
  } finally {
    await dbClient.end();
  }

  feedState.xml = buildRssFeed([
    {
      description: "Duplicate first article description",
      guid: "entry-duplicate",
      link: "https://example.com/articles/duplicate",
      pubDate: "Sat, 12 Apr 2026 10:30:00 GMT",
      title: "Duplicate article",
    },
    {
      description: "Duplicate first article description",
      guid: "entry-duplicate",
      link: "https://example.com/articles/duplicate",
      pubDate: "Sat, 12 Apr 2026 10:30:00 GMT",
      title: "Duplicate article",
    },
  ]);

  const duplicateWithinBatchRun = await runRssSourceSyncJob(
    {
      databaseUrl,
      sourceId: createdSource.id,
      triggerRef: `smoke-duplicate-within-batch-${randomUUID()}`,
    },
  );

  assert.equal(duplicateWithinBatchRun.fetchedCount, 2);
  assert.equal(duplicateWithinBatchRun.persistedCount, 1);
  assert.equal(duplicateWithinBatchRun.skippedCount, 1);

  dbClient = createSqlClient(databaseUrl);
  db = createDbFromClient(dbClient);

  try {
    const [syncStateAfterFirstRun] = await db
      .select()
      .from(sourceSyncState)
      .where(eq(sourceSyncState.sourceId, createdSource.id));
    const rawAssetsAfterFirstRun = await db.select().from(rawAssets);
    const itemsAfterFirstRun = await db.select().from(items);
    const firstNormalizedItem = itemsAfterFirstRun.find(
      (item) => item.canonicalUrl === "https://example.com/articles/1",
    );
    const firstNormalizedItemMetadata = (firstNormalizedItem?.metadata ?? {}) as ItemMetadata;

    assert.ok(syncStateAfterFirstRun);
    assert.ok(syncStateAfterFirstRun.lastSyncedAt);
    assert.ok(syncStateAfterFirstRun.lastSuccessAt);
    assert.equal(syncStateAfterFirstRun.lastErrorAt, null);
    assert.equal(syncStateAfterFirstRun.lastErrorMessage, null);
    assert.equal(syncStateAfterFirstRun.cursor, JSON.stringify({
      latestExternalIds: ["entry-duplicate"],
      latestPublishedAt: "2026-04-12T10:30:00.000Z",
      latestUrls: ["https://example.com/articles/duplicate"],
    }));
    assert.equal(rawAssetsAfterFirstRun.length, 4);
    assert.equal(itemsAfterFirstRun.length, 4);
    assert.equal(rawAssetsAfterFirstRun.every((rawAsset) => rawAsset.status === "normalized"), true);
    assert.equal(itemsAfterFirstRun.every((item) => item.status === "new"), true);
    assert.equal(firstNormalizedItem?.language, "en");
    assert.equal(
      firstNormalizedItem?.contentText,
      "First article description & details.\n\nSecond paragraph.",
    );
    assert.equal(firstNormalizedItemMetadata.connectorType, "rss");
    assert.equal(firstNormalizedItemMetadata.rss?.feedLanguage, "en");
    assert.equal(firstNormalizedItemMetadata.rss?.feedTitle, "Signal Inbox Feed");
    assert.equal(firstNormalizedItemMetadata.rss?.feedUrl, "https://example.com/feed");
    assert.equal(syncStateAfterFirstRun.sourceId, createdSource.id);
  } finally {
    await dbClient.end();
  }

  const duplicateRun = await runRssSourceSyncJob(
    {
      databaseUrl,
      sourceId: createdSource.id,
      triggerRef: `smoke-duplicate-${randomUUID()}`,
    },
  );

  assert.equal(duplicateRun.fetchedCount, 2);
  assert.equal(duplicateRun.persistedCount, 0);
  assert.equal(duplicateRun.skippedCount, 2);
  assert.equal(duplicateRun.normalizedItemIds.length, 0);

  feedState.xml = buildRssFeed([
    {
      description: "Third article description",
      guid: "entry-3",
      link: "https://example.com/articles/3",
      pubDate: "Sat, 12 Apr 2026 11:00:00 GMT",
      title: "Third article",
    },
    {
      description: "First article description",
      guid: "entry-1",
      link: "https://example.com/articles/1",
      pubDate: "Sat, 12 Apr 2026 10:00:00 GMT",
      title: "First article",
    },
  ]);

  const incrementalRun = await runRssSourceSyncJob(
    {
      databaseUrl,
      sourceId: createdSource.id,
      triggerRef: `smoke-incremental-${randomUUID()}`,
    },
  );

  assert.equal(incrementalRun.fetchedCount, 2);
  assert.equal(incrementalRun.persistedCount, 1);
  assert.equal(incrementalRun.skippedCount, 1);
  assert.equal(incrementalRun.normalizedItemIds.length, 1);

  const duplicateUrlSource = await createRssSource(
    {
      name: "RSS Duplicate URL Feed",
      sourceUrl: duplicateSourceUrl,
      topic: "AI Duplicate",
    },
    databaseUrl,
  );

  feedState.xml = buildRssFeed([
    {
      description: "<p>Same article from another source.</p>",
      guid: "entry-cross-source-1",
      link: "https://example.com/articles/1",
      pubDate: "Sat, 12 Apr 2026 12:00:00 GMT",
      title: "First article duplicate from another source",
    },
  ]);

  const duplicateUrlRun = await runRssSourceSyncJob(
    {
      databaseUrl,
      sourceId: duplicateUrlSource.id,
      triggerRef: `smoke-duplicate-url-${randomUUID()}`,
    },
  );

  assert.equal(duplicateUrlRun.fetchedCount, 1);
  assert.equal(duplicateUrlRun.persistedCount, 1);
  assert.equal(duplicateUrlRun.skippedCount, 0);
  assert.equal(duplicateUrlRun.normalizedItemIds.length, 1);

  feedState.mode = "failure";

  await assert.rejects(
    () =>
      runRssSourceSyncJob({
        databaseUrl,
        sourceId: createdSource.id,
        triggerRef: `smoke-failure-${randomUUID()}`,
      }),
    (error: unknown) => {
      assert.ok(error instanceof SourceSyncJobError);
      assert.match(error.message, /RSS sync failed/);
      return true;
    },
  );

  dbClient = createSqlClient(databaseUrl);
  db = createDbFromClient(dbClient);

  try {
    const captureEntryRows = await db
      .select()
      .from(captureEntries)
      .where(eq(captureEntries.sourceId, createdSource.id))
      .orderBy(desc(captureEntries.createdAt));
    const rawAssetRows = await db.select().from(rawAssets);
    const itemRows = await db.select().from(items);
    const duplicateUrlItem = itemRows.find((item) => item.id === duplicateUrlRun.normalizedItemIds[0]);
    const duplicateUrlItemMetadata = (duplicateUrlItem?.metadata ?? {}) as ItemMetadata;
    const [finalSyncState] = await db
      .select()
      .from(sourceSyncState)
      .where(eq(sourceSyncState.sourceId, createdSource.id));
    const finalSource = await getRssSource(createdSource.id, databaseUrl);
    const normalizedCaptureMetadata = (captureEntryRows[1]?.metadata ?? {}) as CaptureEntryMetadata;

    assert.equal(captureEntryRows.length, 6);
    assert.equal(captureEntryRows[0]?.status, "failed");
    assert.equal(captureEntryRows[1]?.status, "normalized");
    assert.equal(captureEntryRows[2]?.status, "normalized");
    assert.equal(
      ((captureEntryRows[0]?.metadata ?? {}) as CaptureEntryMetadata & { connectorType?: string })
        .connectorType,
      "rss",
    );
    assert.equal(
      ((captureEntryRows[0]?.metadata ?? {}) as CaptureEntryMetadata & { message?: string }).message,
      `RSS fetch failed for source ${createdSource.id} with status 500.`,
    );
    assert.equal(normalizedCaptureMetadata.phase, "completed");
    assert.equal(normalizedCaptureMetadata.fetchedCount, 2);
    assert.equal(normalizedCaptureMetadata.persistedCount, 1);
    assert.equal(normalizedCaptureMetadata.skippedCount, 1);
    assert.equal(normalizedCaptureMetadata.normalization?.phase, "completed");
    assert.equal(
      ((captureEntryRows[2]?.metadata ?? {}) as CaptureEntryMetadata).normalization?.phase,
      "skipped",
    );
    assert.equal(
      ((captureEntryRows[2]?.metadata ?? {}) as CaptureEntryMetadata).normalization?.reason,
      "no_new_raw_assets",
    );
    assert.equal(rawAssetRows.length, 6);
    assert.equal(itemRows.length, 6);
    assert.equal(duplicateUrlItem?.canonicalUrl, null);
    assert.equal(
      duplicateUrlItemMetadata.canonicalUrlConflict,
      "https://example.com/articles/1",
    );
    assert.ok(finalSyncState?.lastErrorAt);
    assert.match(finalSyncState?.lastErrorMessage ?? "", /status 500/);
    assert.equal(finalSource?.status, "error");
  } finally {
    await dbClient.end();
  }
}

function buildRssFeed(
  items: Array<{
    description: string;
    guid: string;
    link: string;
    pubDate: string;
    title: string;
  }>,
) {
  const itemMarkup = items
    .map(
      (item) => `
        <item>
          <title>${item.title}</title>
          <link>${item.link}</link>
          <guid>${item.guid}</guid>
          <description><![CDATA[${item.description}]]></description>
          <pubDate>${item.pubDate}</pubDate>
        </item>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Signal Inbox Feed</title>
        <link>https://example.com/feed</link>
        <description>Smoke test feed</description>
        <language>en</language>
        ${itemMarkup}
      </channel>
    </rss>`;
}

await main();
