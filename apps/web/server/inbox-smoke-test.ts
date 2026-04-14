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
import { listSelectedInboxItems, refreshInboxSelections } from "@signal-inbox/review";

import { getInboxPageViewModel } from "./inbox";

const inboxSmokeKnowledgeEnrichmentRunner: KnowledgeEnrichmentRunner = async ({ config, item }) => ({
  config,
  output: {
    classification: {
      label: "research",
      topic: item.sourceTopic ?? "AI",
    },
    importanceScore: 0.78,
    keyPoints: [
      "The explicit processing path should rebuild current Inbox selections.",
      "The page read path should consume the current selected output without recomputing it.",
    ],
    noteDraft: null,
    noveltyScore: 0.73,
    preserveRecommendation: "review",
    summary: {
      long: "This submitted URL item validates that processing-driven selection refresh keeps Inbox current without page-read recomputation.",
      short: "Processing-driven selection refresh keeps Inbox current.",
    },
    tags: ["capture", "url", "review"],
    whyItMatters: "The Inbox page should stay read-only while explicit processing keeps current selections fresh.",
  },
});

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

    const viewModelBeforeRefresh = await getInboxPageViewModel();
    assert.equal(
      viewModelBeforeRefresh.items.length,
      0,
      "Inbox page reads should not recompute selections before an explicit rebuild occurs.",
    );

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

    const viewModelAfterRefresh = await getInboxPageViewModel();
    assert.equal(
      viewModelAfterRefresh.items.length,
      selectedItems.length,
      "Inbox page should read the current selected output after an explicit rebuild.",
    );

    const ingestedItem = await ingestSubmittedUrlItem(databaseUrl);
    const viewModelAfterUrlIngest = await getInboxPageViewModel();
    const inboxIngestedItem = viewModelAfterUrlIngest.items.find((item) => item.id === ingestedItem.itemId);

    assert.ok(
      inboxIngestedItem,
      "Explicit processing should refresh selections so submitted URL items appear without page-read recomputation.",
    );
    assert.equal(inboxIngestedItem.title, "Inbox direct URL ingest article");
    assert.equal(inboxIngestedItem.url, ingestedItem.submittedUrl);

    await truncateInboxScenarioTables(client);

    const missingTopicSourceOne = await createSource(db, {
      name: "Missing Topic Feed One",
      publishedAt,
      topic: "Signals",
    });
    const missingTopicSourceTwo = await createSource(db, {
      name: "Missing Topic Feed Two",
      publishedAt,
      topic: "Signals",
    });
    const missingTopicSourceThree = await createSource(db, {
      name: "Missing Topic Feed Three",
      publishedAt,
      topic: "Signals",
    });

    const missingTopicItemIds = [
      await createProcessedItem(db, {
        classification: null,
        contentText: "A browser policy shift changes how personal knowledge capture tools can persist article context across sessions without a stable explicit topic label.",
        importanceScore: 0.83,
        noveltyScore: 0.72,
        publishedAt: new Date("2026-04-12T04:50:00.000Z"),
        sourceId: missingTopicSourceOne,
        summaryShort: "Browser storage policy shift with clear review value despite a missing topic label.",
        title: "Browser storage policy shift",
        topic: null,
        topicGroupTitles: [],
        whyItMatters: "Null-topic rows should remain independent when no real grouping key exists.",
      }),
      await createProcessedItem(db, {
        classification: null,
        contentText: "A model audit methodology update changes how benchmark regressions should be interpreted even when the enrichment output does not carry a stable topic field.",
        importanceScore: 0.82,
        noveltyScore: 0.71,
        publishedAt: new Date("2026-04-12T04:49:00.000Z"),
        sourceId: missingTopicSourceTwo,
        summaryShort: "Model audit methodology update stays important even without a topic label.",
        title: "Model audit methodology update",
        topic: null,
        topicGroupTitles: [],
        whyItMatters: "Independent null-topic rows should not compete under an artificial topic bucket.",
      }),
      await createProcessedItem(db, {
        classification: null,
        contentText: "A robotics workflow case study exposes a new failure pattern that deserves review even though the processed item does not retain a stable topic assignment.",
        importanceScore: 0.81,
        noveltyScore: 0.7,
        publishedAt: new Date("2026-04-12T04:48:00.000Z"),
        sourceId: missingTopicSourceThree,
        summaryShort: "Robotics workflow case study deserves review without relying on a topic label.",
        title: "Robotics workflow case study",
        topic: null,
        topicGroupTitles: [],
        whyItMatters: "Selection should only apply topic diversity to real topic keys.",
      }),
    ];

    const sourcelessItemIds = [
      await createProcessedItem(db, {
        classification: null,
        contentText: "A cache invalidation drill outlines a reusable operational pattern and should remain eligible even when the capture path has no attached source record.",
        importanceScore: 0.8,
        noveltyScore: 0.69,
        publishedAt: new Date("2026-04-12T04:47:00.000Z"),
        sourceId: null,
        summaryShort: "Cache invalidation drill with review value despite a missing source record.",
        title: "Cache invalidation drill",
        topic: "Independent alpha",
        topicGroupTitles: [],
        whyItMatters: "Missing-source rows should not share a synthetic source bucket.",
      }),
      await createProcessedItem(db, {
        classification: null,
        contentText: "A compiler rollout memo describes a concrete migration hazard and should remain eligible even when the capture path has no attached source record.",
        importanceScore: 0.79,
        noveltyScore: 0.68,
        publishedAt: new Date("2026-04-12T04:46:00.000Z"),
        sourceId: null,
        summaryShort: "Compiler rollout memo with review value despite a missing source record.",
        title: "Compiler rollout memo",
        topic: "Independent beta",
        topicGroupTitles: [],
        whyItMatters: "Missing-source rows should stay independent without a real source key.",
      }),
      await createProcessedItem(db, {
        classification: null,
        contentText: "An inference latency note identifies a concrete deployment tradeoff and should remain eligible even when the capture path has no attached source record.",
        importanceScore: 0.78,
        noveltyScore: 0.67,
        publishedAt: new Date("2026-04-12T04:45:00.000Z"),
        sourceId: null,
        summaryShort: "Inference latency note with review value despite a missing source record.",
        title: "Inference latency note",
        topic: "Independent gamma",
        topicGroupTitles: [],
        whyItMatters: "Missing-source rows should stay independent without a real source key.",
      }),
      await createProcessedItem(db, {
        classification: null,
        contentText: "An operations failover brief captures a concrete mitigation pattern and should remain eligible even when the capture path has no attached source record.",
        importanceScore: 0.77,
        noveltyScore: 0.66,
        publishedAt: new Date("2026-04-12T04:44:00.000Z"),
        sourceId: null,
        summaryShort: "Operations failover brief with review value despite a missing source record.",
        title: "Operations failover brief",
        topic: "Independent delta",
        topicGroupTitles: [],
        whyItMatters: "Missing-source rows should stay independent without a real source key.",
      }),
    ];

    const fallbackRefreshResult = await refreshInboxSelections(databaseUrl);
    const fallbackSelectedItems = await listSelectedInboxItems(databaseUrl);
    const fallbackSelectedIds = new Set(fallbackSelectedItems.map((item) => item.id));

    assert.equal(fallbackRefreshResult.selectedCount, 7);
    assert.equal(fallbackSelectedItems.length, 7);

    for (const itemId of [...missingTopicItemIds, ...sourcelessItemIds]) {
      assert.ok(
        fallbackSelectedIds.has(itemId),
        "Items without real topic/source keys should stay independent instead of sharing fallback diversity buckets.",
      );
    }

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
    classification?: string | null;
    contentText: string;
    duplicateOfItemId?: string;
    importanceScore: number;
    noveltyScore: number;
    preserveRecommendation?: "discard" | "keep" | "review";
    publishedAt: Date;
    sourceId: string | null;
    summaryShort: string;
    title: string;
    topic: string | null;
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
    classification: input.classification ?? "research",
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

async function truncateInboxScenarioTables(client: ReturnType<typeof createSqlClient>) {
  await client.unsafe(`
    truncate table
      inbox_selections,
      item_group_members,
      item_groups,
      enrichments,
      items,
      raw_assets,
      capture_entries,
      source_sync_state,
      sources
    restart identity cascade
  `);
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
