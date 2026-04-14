import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { KnowledgeEnrichmentConfig, KnowledgeEnrichmentRunner } from "@signal-inbox/ai";
import { resolveKnowledgeEnrichmentConfig, validateKnowledgeEnrichmentOutput } from "@signal-inbox/ai";
import {
  captureEntries,
  createDbFromClient,
  createSqlClient,
  enrichments,
  items,
  rawAssets,
  runMigrations,
  sourceSyncState,
  sources,
  startTemporaryPostgres,
} from "@signal-inbox/db";

import { ProcessItemJobError, runProcessItemJob } from "./process-item-job";
import invalidFixture from "./fixtures/knowledge-enrichment-invalid.json";
import validFixture from "./fixtures/knowledge-enrichment-valid.json";

async function main() {
  const temporaryPostgres = process.env.DATABASE_URL ? null : await startTemporaryPostgres();
  const databaseUrl = temporaryPostgres?.databaseUrl ?? process.env.DATABASE_URL;

  assert.ok(databaseUrl, "DATABASE_URL must be set or a temporary PostgreSQL instance must start.");

  const glmDefaultConfig = resolveKnowledgeEnrichmentConfig(
    {},
    {
      KNOWLEDGE_ENRICHMENT_BASE_URL: "https://open.bigmodel.cn/api/paas/v4/",
      KNOWLEDGE_ENRICHMENT_MODEL: "glm-4.5-flash",
    },
  );
  const genericDefaultConfig = resolveKnowledgeEnrichmentConfig(
    {},
    {
      KNOWLEDGE_ENRICHMENT_BASE_URL: "https://api.openai.com/v1/",
      KNOWLEDGE_ENRICHMENT_MODEL: "gpt-4o-mini-2024-07-18",
    },
  );
  const overriddenTimeoutConfig = resolveKnowledgeEnrichmentConfig(
    {},
    {
      KNOWLEDGE_ENRICHMENT_BASE_URL: "https://open.bigmodel.cn/api/paas/v4/",
      KNOWLEDGE_ENRICHMENT_MODEL: "glm-4.5-flash",
      KNOWLEDGE_ENRICHMENT_TIMEOUT_MS: "7000",
    },
  );
  const legacyGlmTimeoutConfig = resolveKnowledgeEnrichmentConfig(
    {},
    {
      KNOWLEDGE_ENRICHMENT_BASE_URL: "https://open.bigmodel.cn/api/paas/v4/",
      KNOWLEDGE_ENRICHMENT_MODEL: "glm-4.5-flash",
      KNOWLEDGE_ENRICHMENT_TIMEOUT_MS: "15000",
    },
  );

  assert.equal(glmDefaultConfig.timeoutMs, 60_000);
  assert.equal(genericDefaultConfig.timeoutMs, 15_000);
  assert.equal(legacyGlmTimeoutConfig.timeoutMs, 60_000);
  assert.equal(overriddenTimeoutConfig.timeoutMs, 7_000);

  await runMigrations(databaseUrl);

  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const publishedAt = new Date("2026-04-12T10:00:00.000Z");
  const runnerCalls: Array<{
    config: KnowledgeEnrichmentConfig;
    item: Record<string, unknown>;
  }> = [];

  try {
    const [source] = await db
      .insert(sources)
      .values({
        name: "Knowledge Enrichment Smoke Feed",
        sourceRef: `rss:knowledge-enrichment-smoke:${randomUUID()}`,
        sourceType: "rss",
        sourceUrl: "https://example.com/model-backed-enrichment.xml",
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
        metadata: {
          rawPayloadFingerprint: "raw-payload-should-not-reach-the-model",
        },
        sourceId: source.id,
        status: "normalized",
        triggerRef: `knowledge-enrichment-smoke:${randomUUID()}`,
      })
      .returning({ id: captureEntries.id });

    const [rawAsset] = await db
      .insert(rawAssets)
      .values({
        assetType: "article",
        captureEntryId: captureEntry.id,
        publishedAt,
        rawContent: "<html>RAW PAYLOAD THAT SHOULD NOT BE USED DIRECTLY</html>",
        rawMetadata: {
          rawPayloadFingerprint: "raw-payload-should-not-reach-the-model",
        },
        status: "normalized",
        title: "OpenAI agent systems research",
        url: "https://example.com/articles/model-backed-enrichment",
      })
      .returning({ id: rawAssets.id });

    const [item] = await db
      .insert(items)
      .values({
        canonicalUrl: "https://example.com/articles/model-backed-enrichment",
        contentText:
          "Normalized content for model-backed enrichment. The article explains a practical benchmark, implementation notes, and production follow-up questions.",
        itemType: "article",
        metadata: {
          normalizedFrom: "raw_asset",
        },
        publishedAt,
        rawAssetId: rawAsset.id,
        title: "OpenAI agent systems research",
      })
      .returning({ id: items.id });

    const createRunner = (
      transform: (config: KnowledgeEnrichmentConfig) => ReturnType<typeof validateKnowledgeEnrichmentOutput>,
    ): KnowledgeEnrichmentRunner => {
      return async ({ config, item: runnerItem }) => {
        runnerCalls.push({
          config,
          item: runnerItem as unknown as Record<string, unknown>,
        });

        assert.equal("rawContent" in (runnerItem as unknown as Record<string, unknown>), false);
        assert.equal(
          runnerItem.contentText,
          "Normalized content for model-backed enrichment. The article explains a practical benchmark, implementation notes, and production follow-up questions.",
        );

        return {
          config,
          output: transform(config),
        };
      };
    };

    const initialResult = await runProcessItemJob({
      databaseUrl,
      itemId: item.id,
      knowledgeEnrichmentConfig: {
        maxOutputTokens: 321,
        model: "fixture-model-v1",
        promptVersion: "v1",
        retryAttempts: 0,
        temperature: 0.1,
        timeoutMs: 5_000,
      },
      knowledgeEnrichmentRunner: createRunner((config) => {
        assert.equal(config.model, "fixture-model-v1");
        return validateKnowledgeEnrichmentOutput(validFixture);
      }),
    });

    assert.ok(initialResult.noteId, "A keep recommendation should create a Note.");

    const firstPassRows = await db
      .select()
      .from(enrichments)
      .where(eq(enrichments.itemId, item.id))
      .orderBy(enrichments.createdAt);

    assert.equal(firstPassRows.length, 1);
    assert.equal(firstPassRows[0]?.isCurrent, true);
    assert.equal(firstPassRows[0]?.summaryShort, validFixture.summary.short);
    assert.equal(firstPassRows[0]?.summaryLong, validFixture.summary.long);
    assert.equal(firstPassRows[0]?.whyItMatters, validFixture.why_it_matters);
    assert.equal(firstPassRows[0]?.preserveRecommendation, validFixture.preserve_recommendation);
    assert.equal(firstPassRows[0]?.noteDraft, validFixture.note_draft);
    assert.equal(
      (firstPassRows[0]?.metadata as { generation?: { model?: string } }).generation?.model,
      "fixture-model-v1",
    );

    const rerunFixture = validateKnowledgeEnrichmentOutput({
      ...validFixture,
      importance_score: 0.83,
      note_draft: "## Updated note\n\nThis rerun should become the current enrichment.",
      summary: {
        long: "The rerun updates the long summary while keeping the same normalized input boundary.",
        short: "Updated rerun summary for the same normalized item.",
      },
    });

    const rerunResult = await runProcessItemJob({
      databaseUrl,
      itemId: item.id,
      knowledgeEnrichmentConfig: {
        maxOutputTokens: 654,
        model: "fixture-model-v2",
        promptVersion: "v1",
        retryAttempts: 0,
        temperature: 0.2,
      },
      knowledgeEnrichmentRunner: createRunner((config) => {
        assert.equal(config.model, "fixture-model-v2");
        return rerunFixture;
      }),
      reprocess: true,
    });

    const rerunRows = await db
      .select()
      .from(enrichments)
      .where(eq(enrichments.itemId, item.id))
      .orderBy(enrichments.createdAt);
    const currentRow = rerunRows.find((row) => row.isCurrent);
    const historicalRows = rerunRows.filter((row) => !row.isCurrent);

    assert.equal(rerunResult.summaryShort, rerunFixture.summary.short);
    assert.equal(rerunRows.length, 2);
    assert.equal(historicalRows.length, 1);
    assert.ok(historicalRows[0]?.supersededAt, "The previous enrichment should become historical.");
    assert.equal(currentRow?.summaryShort, rerunFixture.summary.short);
    assert.equal(
      (currentRow?.metadata as { generation?: { model?: string } }).generation?.model,
      "fixture-model-v2",
    );

    const currentEnrichmentIdBeforeFailure = currentRow?.id ?? null;

    await assert.rejects(
      () =>
        runProcessItemJob({
          databaseUrl,
          itemId: item.id,
          knowledgeEnrichmentConfig: {
            model: "fixture-model-invalid",
            promptVersion: "v1",
          },
          knowledgeEnrichmentRunner: createRunner(() =>
            validateKnowledgeEnrichmentOutput(invalidFixture),
          ),
          reprocess: true,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ProcessItemJobError);
        assert.match(error.message, /must contain at least 3 entries|must be a number between 0 and 1/);
        return true;
      },
    );

    const rowsAfterFailure = await db
      .select()
      .from(enrichments)
      .where(eq(enrichments.itemId, item.id))
      .orderBy(enrichments.createdAt);
    const [itemAfterFailure] = await db
      .select({
        metadata: items.metadata,
        status: items.status,
      })
      .from(items)
      .where(eq(items.id, item.id));

    assert.equal(rowsAfterFailure.length, 2);
    assert.equal(rowsAfterFailure.find((row) => row.isCurrent)?.id, currentEnrichmentIdBeforeFailure);
    assert.equal(itemAfterFailure?.status, "processed");
    assert.equal(
      (itemAfterFailure?.metadata as { knowledgeProcessing?: { status?: string } }).knowledgeProcessing?.status,
      "failed",
    );
    assert.equal(runnerCalls.length, 3);

    console.log("Model-backed knowledge enrichment smoke test passed.");
  } finally {
    await client.end();
    await temporaryPostgres?.cleanup();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
