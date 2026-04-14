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
import { listSelectedInboxItems, refreshInboxSelections } from "@signal-inbox/review";

async function main() {
  const useProvidedDatabaseUrl = process.env.SIGNAL_INBOX_SMOKE_USE_DATABASE_URL === "1";
  const temporaryPostgres = useProvidedDatabaseUrl ? null : await startTemporaryPostgres();
  const databaseUrl = temporaryPostgres?.databaseUrl ?? process.env.DATABASE_URL;

  assert.ok(databaseUrl, "DATABASE_URL must be set or a temporary PostgreSQL instance must start.");

  process.env.DATABASE_URL = databaseUrl;

  await runMigrations(databaseUrl);

  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const publishedAt = new Date("2026-04-12T10:00:00.000Z");

  try {
    const primarySourceId = await createSource(db, {
      name: "Primary AI Feed",
      publishedAt,
      topic: "AI",
    });
    const systemsSourceId = await createSource(db, {
      name: "Systems Feed",
      publishedAt,
      topic: "Systems",
    });
    const researchSourceId = await createSource(db, {
      name: "Research Feed",
      publishedAt,
      topic: "Research",
    });

    const primaryAiItemId = await createProcessedItem(db, {
      contentText:
        "Primary AI item with enough detail to be highly ranked for selection. It covers a major model release, benchmark movement, deployment implications, and the parts of the update that change how future evaluations should be read.",
      importanceScore: 0.96,
      noveltyScore: 0.84,
      publishedAt,
      sourceId: primarySourceId,
      summaryShort:
        "Primary AI item summary covering a major model release and why the benchmark movement matters now.",
      title: "Primary AI item",
      topic: "AI",
      topicGroupTitles: ["AI topic"],
      whyItMatters: "Important model release benchmark coverage.",
    });
    const secondAiItemId = await createProcessedItem(db, {
      contentText:
        "Second AI item with a distinct angle but still in the same topic cluster. It explains the follow-up reaction, the missing context from the initial announcement, and the practical implications for developers tracking the release.",
      importanceScore: 0.89,
      noveltyScore: 0.71,
      publishedAt: new Date("2026-04-12T09:30:00.000Z"),
      sourceId: primarySourceId,
      summaryShort:
        "Second AI item summary with a distinct angle on the same release cycle and follow-up implications.",
      title: "Second AI item",
      topic: "AI",
      topicGroupTitles: ["AI topic"],
      whyItMatters: "Follow-up analysis for the same release cycle.",
    });
    const aiTopicOverflowItemId = await createProcessedItem(db, {
      contentText:
        "Third AI topic item that should be blocked by the topic diversity limit. It is a solid row on its own, but it should not earn another slot once the AI cluster already fills its budget.",
      importanceScore: 0.88,
      noveltyScore: 0.72,
      publishedAt: new Date("2026-04-12T09:00:00.000Z"),
      sourceId: primarySourceId,
      summaryShort:
        "Third AI topic item summary that is individually strong but too repetitive for the final queue.",
      title: "Third AI topic item",
      topic: "AI",
      topicGroupTitles: ["AI topic"],
      whyItMatters: "Extra same-cluster item that should not dominate the page.",
    });
    const systemsItemId = await createProcessedItem(db, {
      contentText:
        "Systems item with enough substance to stay in the review queue. It includes operational detail, rollout notes, and downstream implications for engineering teams reviewing infrastructure changes.",
      importanceScore: 0.82,
      noveltyScore: 0.55,
      publishedAt: new Date("2026-04-12T08:30:00.000Z"),
      sourceId: systemsSourceId,
      summaryShort:
        "Systems item summary with enough concrete operational detail to remain useful in the review queue.",
      title: "Systems item",
      topic: "Systems",
      topicGroupTitles: ["Systems topic"],
      whyItMatters: "Relevant infrastructure change for follow-up.",
    });
    const researchItemId = await createProcessedItem(db, {
      contentText:
        "Research item that adds a distinct topic and source to the queue. It summarizes benchmark movement, methodology changes, and what shifted from prior reports.",
      importanceScore: 0.8,
      noveltyScore: 0.64,
      publishedAt: new Date("2026-04-12T08:00:00.000Z"),
      sourceId: researchSourceId,
      summaryShort:
        "Research item summary describing a distinct benchmark shift and why it matters to future evaluations.",
      title: "Research item",
      topic: "Research",
      topicGroupTitles: ["Research topic"],
      whyItMatters: "Introduces a new benchmark direction.",
    });
    const agentItemId = await createProcessedItem(db, {
      contentText:
        "Agent item from the same source but a distinct topic bucket. It covers workflow changes, failure cases, and a new execution pattern that deserves later review.",
      importanceScore: 0.78,
      noveltyScore: 0.6,
      publishedAt: new Date("2026-04-12T07:30:00.000Z"),
      sourceId: primarySourceId,
      summaryShort:
        "Agent item summary with enough detail to justify a later read on workflow and execution changes.",
      title: "Agent item",
      topic: "Agents",
      topicGroupTitles: ["Agents topic"],
      whyItMatters: "Shows the source diversity rule still allows some variety from one feed.",
    });
    const infraItemId = await createProcessedItem(db, {
      contentText:
        "Infrastructure item from the same source that still fits under the source cap. It includes enough context to be reviewable, but it should now lose to the stricter per-source budget.",
      importanceScore: 0.77,
      noveltyScore: 0.58,
      publishedAt: new Date("2026-04-12T07:00:00.000Z"),
      sourceId: primarySourceId,
      summaryShort:
        "Infrastructure item summary with enough substance to be eligible before the stricter source cap applies.",
      title: "Infrastructure item",
      topic: "Infrastructure",
      topicGroupTitles: ["Infrastructure topic"],
      whyItMatters: "Keeps one more distinct source topic in the queue.",
    });
    const sourceOverflowItemId = await createProcessedItem(db, {
      contentText:
        "Fifth item from the primary source, which should be rejected by the source cap. It still has enough content to be reviewable on its own, which keeps the test focused on the source diversity rule.",
      importanceScore: 0.76,
      noveltyScore: 0.57,
      publishedAt: new Date("2026-04-12T06:30:00.000Z"),
      sourceId: primarySourceId,
      summaryShort:
        "Source overflow item summary with enough detail to stay eligible before the source cap applies.",
      title: "Source overflow item",
      topic: "Operations",
      topicGroupTitles: ["Operations topic"],
      whyItMatters: "Useful but should lose to the source diversity budget.",
    });
    const nearDuplicateTitleItemId = await createProcessedItem(db, {
      contentText:
        "A separate source repeats the same headline framing as the top AI item. It should be treated as near-duplicate coverage even though the item id and source are different.",
      importanceScore: 0.87,
      noveltyScore: 0.69,
      publishedAt: new Date("2026-04-12T06:15:00.000Z"),
      sourceId: researchSourceId,
      summaryShort:
        "A second source uses almost the same headline and would otherwise compete for the selected queue.",
      title: "Primary AI item: follow-up analysis",
      topic: "AI Industry",
      topicGroupTitles: ["AI industry topic"],
      whyItMatters: "Important, but still too repetitive to earn another slot.",
    });
    const duplicateItemId = await createProcessedItem(db, {
      contentText: "Duplicate AI coverage that should be filtered before selection.",
      duplicateOfItemId: primaryAiItemId,
      importanceScore: 0.93,
      noveltyScore: 0.7,
      publishedAt: new Date("2026-04-12T06:00:00.000Z"),
      sourceId: primarySourceId,
      summaryShort: "Duplicate AI item summary",
      title: "Duplicate AI item",
      topic: "AI",
      topicGroupTitles: ["AI topic"],
      whyItMatters: "This should not survive the duplicate filter.",
    });
    const discardedItemId = await createProcessedItem(db, {
      contentText: "Discarded item that should not survive the hard filter pipeline.",
      importanceScore: 0.92,
      noveltyScore: 0.83,
      preserveRecommendation: "discard",
      publishedAt: new Date("2026-04-12T05:30:00.000Z"),
      sourceId: systemsSourceId,
      summaryShort: "Discarded item summary",
      title: "Discarded item",
      topic: "Systems",
      topicGroupTitles: ["Systems topic"],
      whyItMatters: "Explicit discard should win over score.",
    });
    const weakVisibleContentItemId = await createProcessedItem(db, {
      contentText: "Short note.",
      importanceScore: 0.79,
      noveltyScore: 0.66,
      publishedAt: new Date("2026-04-12T05:15:00.000Z"),
      sourceId: systemsSourceId,
      summaryShort: "Quick note",
      title: "Quick note",
      topic: "Systems",
      topicGroupTitles: ["Systems topic"],
      whyItMatters: null,
    });
    const lowSignalItemId = await createProcessedItem(db, {
      contentText: "Short note.",
      importanceScore: 0.2,
      noveltyScore: 0.2,
      publishedAt: new Date("2026-04-12T05:00:00.000Z"),
      sourceId: researchSourceId,
      summaryShort: "Low signal item summary",
      title: "Low signal item",
      topic: "Research",
      topicGroupTitles: ["Research topic"],
      whyItMatters: null,
    });

    const refreshResult = await refreshInboxSelections(databaseUrl);
    const selectedItems = await listSelectedInboxItems(databaseUrl);

    assert.equal(refreshResult.candidateCount, 13);
    assert.equal(refreshResult.selectedCount, 5);
    assert.equal(selectedItems.length, 5, "Selection should keep a smaller, higher-signal queue.");

    const selectedItemIds = new Set(selectedItems.map((item) => item.id));

    assert.ok(selectedItemIds.has(primaryAiItemId));
    assert.ok(selectedItemIds.has(secondAiItemId));
    assert.ok(selectedItemIds.has(systemsItemId));
    assert.ok(selectedItemIds.has(researchItemId));
    assert.ok(selectedItemIds.has(agentItemId));

    assert.equal(selectedItemIds.has(aiTopicOverflowItemId), false);
    assert.equal(selectedItemIds.has(infraItemId), false);
    assert.equal(selectedItemIds.has(sourceOverflowItemId), false);
    assert.equal(selectedItemIds.has(nearDuplicateTitleItemId), false);
    assert.equal(selectedItemIds.has(duplicateItemId), false);
    assert.equal(selectedItemIds.has(discardedItemId), false);
    assert.equal(selectedItemIds.has(weakVisibleContentItemId), false);
    assert.equal(selectedItemIds.has(lowSignalItemId), false);

    assert.equal(
      selectedItems.filter((item) => item.topicGroupTitle === "AI topic").length,
      2,
      "The AI topic cluster should be capped to avoid page domination.",
    );
    assert.equal(
      selectedItems.filter((item) => item.sourceName === "Primary AI Feed").length,
      3,
      "One source should not exceed the explicit source budget.",
    );
    assert.equal(
      selectedItems.filter((item) => item.duplicateOfItemId !== null).length,
      0,
      "Duplicate items should be filtered before rendering.",
    );

    const selectedPrimaryItem = selectedItems.find((item) => item.id === primaryAiItemId);
    assert.ok(selectedPrimaryItem, "Primary AI item should appear in the selected queue.");
    assert.equal(selectedPrimaryItem.selectionPolicyVersion, "v2");
    assert.ok(selectedPrimaryItem.selectionScore > 0.8);
    assert.ok(selectedPrimaryItem.selectionReasons.includes("high_importance"));
    assert.ok(selectedPrimaryItem.selectionReasons.includes("meaningful_summary"));
    assert.equal(selectedPrimaryItem.selectionMetadata.candidateWindow, 64);
    assert.equal(selectedPrimaryItem.selectionMetadata.maxPerSource, 3);

    console.log(
      JSON.stringify(
        selectedItems.slice(0, 3).map((item) => ({
          id: item.id,
          policyVersion: item.selectionPolicyVersion,
          reasons: item.selectionReasons,
          relevanceScore: item.selectionScore,
          scoreBreakdown: item.scoreBreakdown,
          title: item.title,
        })),
        null,
        2,
      ),
    );
    console.log("Inbox selection smoke test passed.");
  } finally {
    await client.end();
    await temporaryPostgres?.cleanup();
  }
}

async function createSource(
  db: ReturnType<typeof createDbFromClient>,
  input: {
    name: string;
    publishedAt: Date;
    topic: string;
  },
) {
  const [source] = await db
    .insert(sources)
    .values({
      name: input.name,
      sourceRef: `rss:inbox-smoke:${randomUUID()}`,
      sourceType: "rss",
      sourceUrl: "https://example.com/feed.xml",
      topic: input.topic,
    })
    .returning({ id: sources.id });

  await db.insert(sourceSyncState).values({
    sourceId: source.id,
    lastSuccessAt: input.publishedAt,
    lastSyncedAt: input.publishedAt,
  });

  return source.id;
}

async function createProcessedItem(
  db: ReturnType<typeof createDbFromClient>,
  input: {
    contentText: string;
    duplicateOfItemId?: string;
    importanceScore: number;
    noveltyScore: number;
    preserveRecommendation?: "discard" | "keep" | "review";
    publishedAt: Date;
    sourceId: string;
    summaryShort: string;
    title: string;
    topic: string;
    topicGroupTitles: string[];
    whyItMatters: string | null;
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
      metadata: input.duplicateOfItemId
        ? {
            knowledgeProcessing: {
              duplicateOfItemId: input.duplicateOfItemId,
            },
          }
        : {},
      rawAssetId: rawAsset.id,
      itemType: "article",
      status: "processed",
      title: input.title,
      publishedAt: input.publishedAt,
    })
    .returning({ id: items.id });

  await db.insert(enrichments).values({
    classification: "research",
    importanceScore: input.importanceScore,
    itemId: item.id,
    noveltyScore: input.noveltyScore,
    preserveRecommendation: input.preserveRecommendation,
    summaryShort: input.summaryShort,
    topic: input.topic,
    whyItMatters: input.whyItMatters,
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
