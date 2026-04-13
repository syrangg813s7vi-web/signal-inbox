import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { KnowledgeEnrichmentRunner } from "@signal-inbox/ai";
import {
  captureEntries,
  createDbFromClient,
  createSqlClient,
  items,
  rawAssets,
  runMigrations,
  sourceSyncState,
  sources,
  startTemporaryPostgres,
} from "@signal-inbox/db";
import { runProcessItemJob } from "@signal-inbox/core";

import { getKnowledgePageViewModel } from "./knowledge";

const knowledgeSmokeRunner: KnowledgeEnrichmentRunner = async ({ config, item }) => ({
  config,
  output: {
    classification: {
      label: "research",
      topic: item.sourceTopic ?? "AI",
    },
    importanceScore: 0.9,
    keyPoints: [
      "The article introduces a benchmark for long-form agent evaluation.",
      "It includes implementation notes relevant to production adoption.",
      "It is worth preserving as a reference note.",
    ],
    noteDraft: "## Benchmark note\n\nThis item is worth preserving for later knowledge review.",
    noveltyScore: 0.7,
    preserveRecommendation: "keep",
    summary: {
      long: "The article covers benchmark details, implementation notes, and follow-up production questions.",
      short: "OpenAI agent systems research highlights a practical benchmark for long-form evaluation.",
    },
    tags: ["research", "agents", "evaluation"],
    whyItMatters:
      "It is a concrete reference point for later agent-system evaluation work.",
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
    const [source] = await db
      .insert(sources)
      .values({
        name: "Knowledge Smoke Feed",
        sourceRef: `rss:knowledge-smoke:${randomUUID()}`,
        sourceType: "rss",
        sourceUrl: "https://example.com/knowledge.xml",
        topic: "AI",
      })
      .returning({ id: sources.id });

    await db.insert(sourceSyncState).values({
      lastSuccessAt: publishedAt,
      lastSyncedAt: publishedAt,
      sourceId: source.id,
    });

    const [captureEntry] = await db
      .insert(captureEntries)
      .values({
        capturedAt: publishedAt,
        entryType: "source_sync",
        sourceId: source.id,
        status: "normalized",
        triggerRef: `knowledge-smoke:${randomUUID()}`,
      })
      .returning({ id: captureEntries.id });

    const [rawAsset] = await db
      .insert(rawAssets)
      .values({
        assetType: "article",
        captureEntryId: captureEntry.id,
        publishedAt,
        rawContent:
          "OpenAI agent systems research highlights a practical benchmark for long-form evaluation. The write-up includes detailed analysis, implementation notes, and follow-up questions for production usage.",
        status: "normalized",
        title: "OpenAI agent systems research",
        url: "https://example.com/articles/knowledge-smoke",
      })
      .returning({ id: rawAssets.id });

    const [item] = await db
      .insert(items)
      .values({
        canonicalUrl: "https://example.com/articles/knowledge-smoke",
        contentText:
          "OpenAI agent systems research highlights a practical benchmark for long-form evaluation. The write-up includes detailed analysis, implementation notes, and follow-up questions for production usage.",
        itemType: "article",
        metadata: {},
        publishedAt,
        rawAssetId: rawAsset.id,
        title: "OpenAI agent systems research",
      })
      .returning({ id: items.id });

    const processResult = await runProcessItemJob({
      databaseUrl,
      itemId: item.id,
      knowledgeEnrichmentRunner: knowledgeSmokeRunner,
    });

    assert.ok(processResult.noteId, "Processing should create a preservation Note.");
    assert.equal(processResult.syncedDestinationCount, 2);

    const viewModel = await getKnowledgePageViewModel();
    const note = viewModel.notes.find((candidate) => candidate.itemId === item.id);

    assert.equal(viewModel.isAvailable, true);
    assert.ok(note, "Created Note should appear in the Knowledge view model.");
    assert.equal(note?.title, "OpenAI agent systems research");
    assert.equal(note?.destinationStatuses.length, 2);
    assert.equal(viewModel.destinations.length, 2);

    console.log("Knowledge smoke test passed.");
  } finally {
    await client.end();
    await temporaryPostgres?.cleanup();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
