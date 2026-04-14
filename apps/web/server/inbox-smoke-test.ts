import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";

import type { KnowledgeEnrichmentRunner } from "@signal-inbox/ai";
import {
  captureEntries,
  createDbFromClient,
  createSqlClient,
  enrichments,
  itemGroupMembers,
  itemGroups,
  items,
  rawAssets,
  runMigrations,
  sourceSyncState,
  sources,
  startTemporaryPostgres,
} from "@signal-inbox/db";
import { runNormalizeRawAssetJob, runProcessItemJob, runSubmittedUrlIngestJob } from "@signal-inbox/core";

import { getInboxPageViewModel } from "./inbox";

const inboxSmokeKnowledgeEnrichmentRunner: KnowledgeEnrichmentRunner = async ({ config, item }) => ({
  config,
  output: {
    classification: {
      label: "research",
      topic: item.sourceTopic ?? "AI",
    },
    importanceScore: 0.7,
    keyPoints: [
      "The ingested article completed the shared URL capture path.",
      "The processed Item should remain visible on the Inbox surface.",
    ],
    noteDraft: null,
    noveltyScore: 0.7,
    preserveRecommendation: "review",
    summary: {
      long: "The direct URL ingest path should continue into Inbox without being hidden behind older queue entries.",
      short: "Direct URL ingest should remain visible in Inbox.",
    },
    tags: ["research", "capture", "url"],
    whyItMatters: "The Inbox surface needs to expose newly processed direct URL submissions.",
  },
});

async function main() {
  const temporaryPostgres = process.env.DATABASE_URL ? null : await startTemporaryPostgres();
  const databaseUrl = temporaryPostgres?.databaseUrl ?? process.env.DATABASE_URL;

  assert.ok(databaseUrl, "DATABASE_URL must be set or a temporary PostgreSQL instance must start.");

  process.env.DATABASE_URL = databaseUrl;

  await runMigrations(databaseUrl);

  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const publishedAt = new Date("2026-04-12T10:00:00.000Z");

  try {
    const sourceId = await createSource(db, publishedAt);
    const duplicateMembershipItemId = await createProcessedItem(db, {
      contentText: "Duplicate membership item explanation.",
      publishedAt,
      sourceId,
      summaryShort: "Duplicate membership item summary",
      title: "Duplicate membership item",
      topic: "AI",
      topicGroupTitles: ["AI topic", "Artificial Intelligence"],
    });
    const singleMembershipItemId = await createProcessedItem(db, {
      contentText: "Single membership item explanation.",
      publishedAt,
      sourceId,
      summaryShort: "Single membership item summary",
      title: "Single membership item",
      topic: "Systems",
      topicGroupTitles: ["Systems topic"],
    });
    const legacySummaryItemId = await createProcessedItem(db, {
      contentText:
        "Hi HN! I recently switched from a Fedora laptop to a MacBook Air and built a taskbar-style dock replacement to keep my workflow intact.",
      publishedAt,
      sourceId,
      summaryShort: "Show HN: boringBar – a taskbar-style dock replacement for macOS: Hi HN!",
      title: "Show HN: boringBar – a taskbar-style dock replacement for macOS",
      topic: "Builders",
      topicGroupTitles: [],
    });

    const viewModel = await getInboxPageViewModel();

    assert.equal(viewModel.isAvailable, true);

    const duplicateMembershipItem = viewModel.items.find((item) => item.id === duplicateMembershipItemId);
    const legacySummaryItem = viewModel.items.find((item) => item.id === legacySummaryItemId);
    const singleMembershipItem = viewModel.items.find((item) => item.id === singleMembershipItemId);

    assert.ok(duplicateMembershipItem, "Duplicate membership item should appear in Inbox.");
    assert.ok(legacySummaryItem, "Legacy summary item should appear in Inbox.");
    assert.ok(singleMembershipItem, "Single membership item should appear in Inbox.");

    assert.equal(
      viewModel.items.filter((item) => item.id === duplicateMembershipItemId).length,
      1,
      "Duplicate historical memberships should not create duplicate Inbox rows.",
    );
    assert.equal(
      duplicateMembershipItem.topicGroupTitle,
      null,
      "Ambiguous historical memberships should not surface an arbitrary group label.",
    );
    assert.equal(singleMembershipItem.topicGroupTitle, "Systems topic");
    assert.equal(duplicateMembershipItem.sourceName, "Inbox Smoke Feed");
    assert.equal(duplicateMembershipItem.sourceTopic, "AI");
    assert.equal(duplicateMembershipItem.sourceTypeLabel, "RSS");
    assert.equal(
      legacySummaryItem.summaryShort,
      "I recently switched from a Fedora laptop to a MacBook Air and built a taskbar-style dock replacement to keep my workflow intact.",
    );
    assert.equal(singleMembershipItem.sourceName, "Inbox Smoke Feed");

    for (let index = 0; index < 24; index += 1) {
      await createProcessedItem(db, {
        contentText: `Historical queue item ${index + 1} explanation.`,
        publishedAt: new Date(`2026-03-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`),
        sourceId,
        summaryShort: `Historical queue item ${index + 1} summary`,
        title: `Historical queue item ${index + 1}`,
        topic: "AI",
        topicGroupTitles: [],
      });
    }

    const ingestedItem = await ingestSubmittedUrlItem(databaseUrl);
    const viewModelAfterUrlIngest = await getInboxPageViewModel();
    const inboxIngestedItem = viewModelAfterUrlIngest.items.find((item) => item.id === ingestedItem.itemId);

    assert.ok(inboxIngestedItem, "Direct URL-ingested Items should remain visible in Inbox.");
    assert.equal(inboxIngestedItem.title, "Inbox direct URL ingest article");
    assert.equal(inboxIngestedItem.url, ingestedItem.submittedUrl);

    console.log("Inbox smoke test passed.");
  } finally {
    await client.end();
    await temporaryPostgres?.cleanup();
  }
}

async function createSource(
  db: ReturnType<typeof createDbFromClient>,
  publishedAt: Date,
) {
  const [source] = await db
    .insert(sources)
    .values({
      name: "Inbox Smoke Feed",
      sourceRef: `rss:inbox-smoke:${randomUUID()}`,
      sourceType: "rss",
      sourceUrl: "https://example.com/feed.xml",
      topic: "AI",
    })
    .returning({ id: sources.id });

  await db.insert(sourceSyncState).values({
    sourceId: source.id,
    lastSuccessAt: publishedAt,
    lastSyncedAt: publishedAt,
  });

  return source.id;
}

async function createProcessedItem(
  db: ReturnType<typeof createDbFromClient>,
  input: {
    contentText: string;
    publishedAt: Date;
    sourceId: string;
    summaryShort: string;
    title: string;
    topic: string;
    topicGroupTitles: string[];
  },
) {
  const [captureEntry] = await db
    .insert(captureEntries)
    .values({
      capturedAt: input.publishedAt,
      entryType: "source_sync",
      sourceId: input.sourceId,
      status: "normalized",
      triggerRef: `inbox-smoke:${randomUUID()}`,
    })
    .returning({ id: captureEntries.id });

  const [rawAsset] = await db
    .insert(rawAssets)
    .values({
      assetType: "article",
      captureEntryId: captureEntry.id,
      status: "normalized",
      title: input.title,
      url: `https://example.com/articles/${randomUUID()}`,
    })
    .returning({ id: rawAssets.id });

  const [item] = await db
    .insert(items)
    .values({
      contentText: input.contentText,
      rawAssetId: rawAsset.id,
      itemType: "article",
      status: "processed",
      title: input.title,
      publishedAt: input.publishedAt,
      metadata: {},
    })
    .returning({ id: items.id });

  await db.insert(enrichments).values({
    itemId: item.id,
    classification: "research",
    importanceScore: 0.9,
    noveltyScore: 0.4,
    summaryShort: input.summaryShort,
    topic: input.topic,
  });

  for (const topicGroupTitle of input.topicGroupTitles) {
    const [group] = await db
      .insert(itemGroups)
      .values({
        groupType: "topic",
        tag: `${topicGroupTitle.toLowerCase().replaceAll(/\s+/g, "-")}-${randomUUID()}`,
        title: topicGroupTitle,
      })
      .returning({ id: itemGroups.id });

    await db.insert(itemGroupMembers).values({
      groupId: group.id,
      itemId: item.id,
    });
  }

  return item.id;
}

async function ingestSubmittedUrlItem(databaseUrl: string) {
  const server = http.createServer((request, response) => {
    if (request.url === "/article") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
<html lang="en">
  <head>
    <title>Inbox direct URL ingest article</title>
    <meta property="article:published_time" content="2026-04-14T03:00:00.000Z" />
  </head>
  <body>
    <article>
      <h1>Inbox direct URL ingest article</h1>
      <p>This article validates that direct URL submissions remain visible in the Inbox queue.</p>
      <p>It references AI agents and orchestration to exercise the shared knowledge pipeline.</p>
      <p>${"content ".repeat(200)}</p>
    </article>
  </body>
</html>`);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  assert.ok(address && typeof address !== "string");

  try {
    const submittedUrl = `http://127.0.0.1:${address.port}/article`;
    const result = await runSubmittedUrlIngestJob({
      databaseUrl,
      submittedUrl,
      triggerRef: "inbox-smoke:url-ingest",
      normalizeRawAssetJobRunner: ({ databaseUrl: jobDatabaseUrl, rawAssetId }) =>
        runNormalizeRawAssetJob({
          databaseUrl: jobDatabaseUrl,
          rawAssetId,
          processItemJobRunner: ({ databaseUrl: processDatabaseUrl, itemId }) =>
            runProcessItemJob({
              databaseUrl: processDatabaseUrl,
              itemId,
              knowledgeEnrichmentRunner: inboxSmokeKnowledgeEnrichmentRunner,
            }),
        }),
    });

    return {
      itemId: result.processedItemIds[0]!,
      submittedUrl,
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
