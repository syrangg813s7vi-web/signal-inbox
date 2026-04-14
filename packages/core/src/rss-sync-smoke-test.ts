import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { desc, eq } from "drizzle-orm";

import type { KnowledgeEnrichmentRunner } from "@signal-inbox/ai";
import { createRssSource, getRssSource } from "@signal-inbox/capture";
import {
  captureEntries,
  createDbFromClient,
  createSqlClient,
  enrichments,
  itemGroupMembers,
  itemGroups,
  items,
  knowledgeDestinations,
  notes,
  rawAssets,
  runMigrations,
  sourceSyncState,
  startTemporaryPostgres,
} from "@signal-inbox/db";

import { runNormalizeRawAssetJob } from "./normalize-raw-asset-job";
import {
  runRssSourceSyncJob,
  SourceSyncJobError,
  SourceSyncPostProcessingError,
} from "./capture-sync-job";
import { ProcessItemJobError, runProcessItemJob } from "./process-item-job";

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
  knowledgeProcessing?: {
    duplicateOfItemId?: string | null;
    groupId?: string | null;
    lastCompletedStep?: string | null;
    lastError?: string | null;
    noteId?: string | null;
    order?: string[];
    pipelineVersion?: string;
    status?: string;
    syncedDestinationCount?: number;
  };
  rss?: {
    feedLanguage?: string;
    feedTitle?: string;
    feedUrl?: string;
  };
}

interface EnrichmentMetadata {
  duplicateOfItemId?: string | null;
  lastCompletedStep?: string | null;
  order?: string[];
  pipelineVersion?: string;
  status?: string;
  steps?: {
    dedupe?: {
      dedupeKey?: string;
      duplicateOfItemId?: string | null;
    };
  };
}

const rssSmokeKnowledgeEnrichmentRunner: KnowledgeEnrichmentRunner = async ({ config, item }) => {
  const firstSentence =
    item.contentText?.split(/(?<=[.!?])\s+/)[0]?.trim() ?? item.contentText ?? item.title ?? "Item";
  const topic = item.sourceTopic ?? "General";
  const duplicateTopic = topic === "AI Duplicate";
  const smokeSummaryShort = firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;

  return {
    config,
    output: {
      classification: {
        label: "topic-tracked",
        topic,
      },
      importanceScore: duplicateTopic ? 0.45 : 0.82,
      keyPoints: [
        `${item.title ?? "Item"} is relevant to ${topic}.`,
        firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`,
        duplicateTopic
          ? "The item appears to repeat information already seen from another source."
          : "The item is worth keeping in the processed inbox flow.",
      ],
      noteDraft: duplicateTopic ? null : `## ${item.title ?? "Item"}\n\n${firstSentence}.`,
      noveltyScore: duplicateTopic ? 0.4 : 0.63,
      preserveRecommendation: duplicateTopic ? "discard" : "keep",
      summary: {
        long: `${item.title ?? "Item"} covers ${firstSentence.replace(/\.$/, "")}.`,
        short: smokeSummaryShort,
      },
      tags: [
        "topic_tracked",
        topic.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
        item.language ? `lang_${item.language.toLowerCase()}` : "lang_en",
      ],
      whyItMatters: duplicateTopic
        ? "This duplicate-source item should remain visible for dedupe checks but should not be preserved."
        : "This item is useful enough to remain in Inbox and create a preservation note.",
    },
  };
};

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

  const firstResult = await runSmokeRssSourceSyncJob(
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
  assert.equal(firstResult.processedItemIds.length, 2);

  let dbClient: ReturnType<typeof createSqlClient>;
  let db: ReturnType<typeof createDbFromClient>;

  const repeatedNormalizationResult = await runNormalizeRawAssetJob({
    databaseUrl,
    processItemJobRunner: (processJobInput) =>
      runProcessItemJob({
        ...processJobInput,
        knowledgeEnrichmentRunner: rssSmokeKnowledgeEnrichmentRunner,
      }),
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
        processItemJobRunner: (processJobInput) =>
          runProcessItemJob({
            ...processJobInput,
            knowledgeEnrichmentRunner: rssSmokeKnowledgeEnrichmentRunner,
          }),
        rawAssetId: concurrentRawAsset.id,
      }),
      runNormalizeRawAssetJob({
        databaseUrl,
        processItemJobRunner: (processJobInput) =>
          runProcessItemJob({
            ...processJobInput,
            knowledgeEnrichmentRunner: rssSmokeKnowledgeEnrichmentRunner,
          }),
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

  const duplicateWithinBatchRun = await runSmokeRssSourceSyncJob(
    {
      databaseUrl,
      sourceId: createdSource.id,
      triggerRef: `smoke-duplicate-within-batch-${randomUUID()}`,
    },
  );

  assert.equal(duplicateWithinBatchRun.fetchedCount, 2);
  assert.equal(duplicateWithinBatchRun.persistedCount, 1);
  assert.equal(duplicateWithinBatchRun.skippedCount, 1);
  assert.equal(duplicateWithinBatchRun.processedItemIds.length, 1);

  dbClient = createSqlClient(databaseUrl);
  db = createDbFromClient(dbClient);

  try {
    const [syncStateAfterFirstRun] = await db
      .select()
      .from(sourceSyncState)
      .where(eq(sourceSyncState.sourceId, createdSource.id));
    const enrichmentRowsAfterFirstRun = await db.select().from(enrichments);
    const itemGroupRowsAfterFirstRun = await db.select().from(itemGroups);
    const itemGroupMemberRowsAfterFirstRun = await db.select().from(itemGroupMembers);
    const knowledgeDestinationRows = await db.select().from(knowledgeDestinations);
    const noteRows = await db.select().from(notes);
    const rawAssetsAfterFirstRun = await db.select().from(rawAssets);
    const itemsAfterFirstRun = await db.select().from(items);
    const firstNormalizedItem = itemsAfterFirstRun.find(
      (item) => item.canonicalUrl === "https://example.com/articles/1",
    );
    const firstNormalizedItemMetadata = (firstNormalizedItem?.metadata ?? {}) as ItemMetadata;
    const firstEnrichment = enrichmentRowsAfterFirstRun.find(
      (enrichment) => enrichment.itemId === firstNormalizedItem?.id,
    );
    const firstEnrichmentMetadata = (firstEnrichment?.metadata ?? {}) as EnrichmentMetadata;
    const firstNote = noteRows.find((note) => note.itemId === firstNormalizedItem?.id);
    const firstNoteSync = ((firstNote?.metadata ?? {}) as {
      sync?: {
        destinations?: Record<string, { status?: string }>;
      };
    }).sync;

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
    assert.equal(enrichmentRowsAfterFirstRun.length, 4);
    assert.equal(knowledgeDestinationRows.length, 2);
    assert.equal(noteRows.length >= 1, true);
    assert.equal(itemGroupRowsAfterFirstRun.length, 1);
    assert.equal(itemGroupMemberRowsAfterFirstRun.length, 4);
    assert.equal(rawAssetsAfterFirstRun.every((rawAsset) => rawAsset.status === "normalized"), true);
    assert.equal(itemsAfterFirstRun.every((item) => item.status === "processed"), true);
    assert.equal(firstNormalizedItem?.language, "en");
    assert.equal(
      firstNormalizedItem?.contentText,
      "First article description & details.\n\nSecond paragraph.",
    );
    assert.equal(firstNormalizedItemMetadata.connectorType, "rss");
    assert.equal(firstNormalizedItemMetadata.knowledgeProcessing?.status, "processed");
    assert.equal(firstNormalizedItemMetadata.knowledgeProcessing?.lastCompletedStep, "preserve");
    assert.equal(typeof firstNormalizedItemMetadata.knowledgeProcessing?.noteId, "string");
    assert.equal(firstNormalizedItemMetadata.knowledgeProcessing?.syncedDestinationCount, 2);
    assert.deepEqual(firstNormalizedItemMetadata.knowledgeProcessing?.order, [
      "score",
      "dedupe",
      "summarize",
      "classify",
      "group",
      "preserve",
    ]);
    assert.equal(firstNormalizedItemMetadata.rss?.feedLanguage, "en");
    assert.equal(firstNormalizedItemMetadata.rss?.feedTitle, "Signal Inbox Feed");
    assert.equal(firstNormalizedItemMetadata.rss?.feedUrl, "https://example.com/feed");
    assert.equal(firstEnrichment?.classification, "topic-tracked");
    assert.equal(firstEnrichment?.topic, "AI");
    assert.equal(firstEnrichment?.summaryShort, "First article description & details.");
    assert.equal(typeof firstEnrichment?.importanceScore, "number");
    assert.equal(typeof firstEnrichment?.noveltyScore, "number");
    assert.equal(firstEnrichmentMetadata.status, "processed");
    assert.equal(firstEnrichmentMetadata.pipelineVersion, "v1");
    assert.equal(firstEnrichmentMetadata.lastCompletedStep, "preserve");
    assert.equal(firstEnrichmentMetadata.steps?.dedupe?.dedupeKey, "url:https://example.com/articles/1");
    assert.equal(firstNote?.title, "First article");
    assert.equal(firstNote?.noteType, "reference");
    assert.equal(firstNoteSync?.destinations?.notion?.status, "success");
    assert.equal(firstNoteSync?.destinations?.obsidian?.status, "success");
    assert.equal(syncStateAfterFirstRun.sourceId, createdSource.id);
  } finally {
    await dbClient.end();
  }

  const duplicateRun = await runSmokeRssSourceSyncJob(
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
  assert.equal(duplicateRun.processedItemIds.length, 0);

  feedState.xml = buildRssFeed([
    {
      description: "Knowledge failure article description",
      guid: "entry-processing-failure",
      link: "https://example.com/articles/processing-failure",
      pubDate: "Sat, 12 Apr 2026 10:45:00 GMT",
      title: "Knowledge failure article",
    },
  ]);

  await assert.rejects(
    () =>
      runRssSourceSyncJob({
        databaseUrl,
        normalizeRawAssetJobRunner: (jobInput) =>
          runNormalizeRawAssetJob({
            ...jobInput,
            processItemJobRunner: (processJobInput) =>
              runProcessItemJob({
                ...processJobInput,
                processItemRunner: async ({ itemId }) => {
                  throw new ProcessItemJobError(`Forced knowledge failure for item ${itemId}.`);
                },
              }),
          }),
        sourceId: createdSource.id,
        triggerRef: `smoke-processing-failure-${randomUUID()}`,
      }),
    (error: unknown) => {
      assert.ok(error instanceof SourceSyncPostProcessingError);
      assert.match(error.message, /Post-capture processing failed/);
      return true;
    },
  );

  dbClient = createSqlClient(databaseUrl);
  db = createDbFromClient(dbClient);

  try {
    const captureEntryRowsAfterProcessingFailure = await db
      .select()
      .from(captureEntries)
      .where(eq(captureEntries.sourceId, createdSource.id))
      .orderBy(desc(captureEntries.createdAt));
    const rawAssetRowsAfterProcessingFailure = await db.select().from(rawAssets);
    const itemRowsAfterProcessingFailure = await db.select().from(items);
    const [syncStateAfterProcessingFailure] = await db
      .select()
      .from(sourceSyncState)
      .where(eq(sourceSyncState.sourceId, createdSource.id));
    const sourceAfterProcessingFailure = await getRssSource(createdSource.id, databaseUrl);
    const failedItem = itemRowsAfterProcessingFailure.find(
      (item) => item.canonicalUrl === "https://example.com/articles/processing-failure",
    );
    const failedItemMetadata = (failedItem?.metadata ?? {}) as ItemMetadata;
    const failedRawAsset = rawAssetRowsAfterProcessingFailure.find(
      (rawAsset) => rawAsset.url === "https://example.com/articles/processing-failure",
    );
    const failedCaptureEntryMetadata = (captureEntryRowsAfterProcessingFailure[0]?.metadata ??
      {}) as CaptureEntryMetadata;

    assert.equal(captureEntryRowsAfterProcessingFailure[0]?.status, "normalized");
    assert.equal(failedCaptureEntryMetadata.phase, "completed");
    assert.equal(failedCaptureEntryMetadata.normalization?.phase, "completed");
    assert.equal(failedRawAsset?.status, "normalized");
    assert.equal(failedItem?.status, "new");
    assert.equal(failedItemMetadata.knowledgeProcessing?.status, "failed");
    assert.match(
      failedItemMetadata.knowledgeProcessing?.lastError ?? "",
      /Forced knowledge failure/,
    );
    assert.ok(syncStateAfterProcessingFailure?.lastSuccessAt);
    assert.equal(syncStateAfterProcessingFailure?.lastErrorAt, null);
    assert.equal(syncStateAfterProcessingFailure?.lastErrorMessage, null);
    assert.equal(sourceAfterProcessingFailure?.status, "active");
  } finally {
    await dbClient.end();
  }

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

  const incrementalRun = await runSmokeRssSourceSyncJob(
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
  assert.equal(incrementalRun.processedItemIds.length, 1);

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

  const duplicateUrlRun = await runSmokeRssSourceSyncJob(
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
  assert.equal(duplicateUrlRun.processedItemIds.length, 1);

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
    const enrichmentRows = await db.select().from(enrichments);
    const itemGroupRows = await db.select().from(itemGroups);
    const itemGroupMemberRows = await db.select().from(itemGroupMembers);
    const itemRows = await db.select().from(items);
    const duplicateUrlItem = itemRows.find((item) => item.id === duplicateUrlRun.normalizedItemIds[0]);
    const duplicateUrlItemMetadata = (duplicateUrlItem?.metadata ?? {}) as ItemMetadata;
    const duplicateUrlEnrichment = enrichmentRows.find((enrichment) => enrichment.itemId === duplicateUrlItem?.id);
    const duplicateUrlEnrichmentMetadata = (duplicateUrlEnrichment?.metadata ?? {}) as EnrichmentMetadata;
    const [finalSyncState] = await db
      .select()
      .from(sourceSyncState)
      .where(eq(sourceSyncState.sourceId, createdSource.id));
    const finalSource = await getRssSource(createdSource.id, databaseUrl);
    const fetchFailureCaptureMetadata = (captureEntryRows[0]?.metadata ?? {}) as CaptureEntryMetadata & {
      connectorType?: string;
      message?: string;
    };
    const completedNormalizationCaptureMetadata = captureEntryRows
      .map((captureEntry) => (captureEntry.metadata ?? {}) as CaptureEntryMetadata)
      .find(
        (metadata) =>
          metadata.phase === "completed" &&
          metadata.fetchedCount === 2 &&
          metadata.persistedCount === 1 &&
          metadata.skippedCount === 1 &&
          metadata.normalization?.phase === "completed",
      );
    const skippedNormalizationCaptureMetadata = captureEntryRows
      .map((captureEntry) => (captureEntry.metadata ?? {}) as CaptureEntryMetadata)
      .find(
        (metadata) =>
          metadata.normalization?.phase === "skipped" &&
          metadata.normalization?.reason === "no_new_raw_assets",
      );

    assert.equal(captureEntryRows.length, 7);
    assert.equal(captureEntryRows[0]?.status, "failed");
    assert.equal(fetchFailureCaptureMetadata.connectorType, "rss");
    assert.equal(
      fetchFailureCaptureMetadata.message,
      `RSS fetch failed for source ${createdSource.id} with status 500.`,
    );
    assert.equal(completedNormalizationCaptureMetadata?.phase, "completed");
    assert.equal(completedNormalizationCaptureMetadata?.fetchedCount, 2);
    assert.equal(completedNormalizationCaptureMetadata?.persistedCount, 1);
    assert.equal(completedNormalizationCaptureMetadata?.skippedCount, 1);
    assert.equal(completedNormalizationCaptureMetadata?.normalization?.phase, "completed");
    assert.equal(skippedNormalizationCaptureMetadata?.normalization?.phase, "skipped");
    assert.equal(skippedNormalizationCaptureMetadata?.normalization?.reason, "no_new_raw_assets");
    assert.equal(rawAssetRows.length, 7);
    assert.equal(itemRows.length, 7);
    assert.equal(enrichmentRows.length, 6);
    assert.equal(itemGroupRows.length, 2);
    assert.equal(itemGroupMemberRows.length, 6);
    assert.equal(duplicateUrlItem?.canonicalUrl, null);
    assert.equal(duplicateUrlItem?.status, "processed");
    assert.equal(
      duplicateUrlItemMetadata.canonicalUrlConflict,
      "https://example.com/articles/1",
    );
    assert.equal(duplicateUrlItemMetadata.knowledgeProcessing?.status, "processed");
    assert.equal(
      duplicateUrlItemMetadata.knowledgeProcessing?.duplicateOfItemId,
      firstResult.normalizedItemIds[0],
    );
    assert.equal(duplicateUrlEnrichment?.noveltyScore, 0);
    assert.equal(
      duplicateUrlEnrichmentMetadata.duplicateOfItemId,
      firstResult.normalizedItemIds[0],
    );
    assert.equal(
      duplicateUrlEnrichmentMetadata.steps?.dedupe?.duplicateOfItemId,
      firstResult.normalizedItemIds[0],
    );
    assert.ok(finalSyncState?.lastErrorAt);
    assert.match(finalSyncState?.lastErrorMessage ?? "", /status 500/);
    assert.equal(finalSource?.status, "error");
  } finally {
    await dbClient.end();
  }
}

async function runSmokeRssSourceSyncJob(
  input: Parameters<typeof runRssSourceSyncJob>[0],
) {
  return runRssSourceSyncJob({
    ...input,
    normalizeRawAssetJobRunner: (jobInput) =>
      runNormalizeRawAssetJob({
        ...jobInput,
        processItemJobRunner: (processJobInput) =>
          runProcessItemJob({
            ...processJobInput,
            knowledgeEnrichmentRunner: rssSmokeKnowledgeEnrichmentRunner,
          }),
      }),
  });
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
