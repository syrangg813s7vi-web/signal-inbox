import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

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

import { getInboxPageViewModel } from "./inbox";

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
      publishedAt,
      sourceId,
      title: "Duplicate membership item",
      topic: "AI",
      topicGroupTitles: ["AI topic", "Artificial Intelligence"],
    });
    const singleMembershipItemId = await createProcessedItem(db, {
      publishedAt,
      sourceId,
      title: "Single membership item",
      topic: "Systems",
      topicGroupTitles: ["Systems topic"],
    });

    const viewModel = await getInboxPageViewModel();

    assert.equal(viewModel.isAvailable, true);

    const duplicateMembershipItem = viewModel.items.find((item) => item.id === duplicateMembershipItemId);
    const singleMembershipItem = viewModel.items.find((item) => item.id === singleMembershipItemId);

    assert.ok(duplicateMembershipItem, "Duplicate membership item should appear in Inbox.");
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
    assert.equal(singleMembershipItem.sourceName, "Inbox Smoke Feed");

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
    publishedAt: Date;
    sourceId: string;
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
    summaryShort: `${input.title} summary`,
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

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
