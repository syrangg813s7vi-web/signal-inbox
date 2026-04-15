import assert from "node:assert/strict";
import http from "node:http";

import { eq } from "drizzle-orm";

import type { KnowledgeEnrichmentRunner } from "@signal-inbox/ai";
import {
  bootstrapKnowledgeStorageSchema,
  createDbFromClient,
  createSqlClient,
  createSqlClient as createClient,
  items,
  rawAssets,
} from "@signal-inbox/db";

import { runNormalizeRawAssetJob } from "./normalize-raw-asset-job";
import { runProcessItemJob } from "./process-item-job";
import { runSubmittedUrlIngestJob } from "./url-ingest-job";

import { captureEntries, startTemporaryPostgres } from "../../db/src";

async function main() {
  const useProvidedDatabaseUrl = process.env.SIGNAL_INBOX_SMOKE_USE_DATABASE_URL === "1";
  const temporaryPostgres = useProvidedDatabaseUrl ? null : await startTemporaryPostgres();
  const databaseUrl = temporaryPostgres?.databaseUrl ?? process.env.DATABASE_URL;

  assert.ok(databaseUrl, "DATABASE_URL must be set or a temporary PostgreSQL instance must start.");

  try {
    await bootstrapKnowledgeStorageSchema(databaseUrl);
    await runUrlIngestSmokeTest(databaseUrl);
    console.log("URL ingest smoke test passed.");
  } finally {
    await temporaryPostgres?.cleanup();
  }
}

async function runUrlIngestSmokeTest(databaseUrl: string) {
  const knowledgeEnrichmentRunner = buildSmokeKnowledgeEnrichmentRunner();
  const server = http.createServer((request, response) => {
    if (request.url === "/article-with-embedded-video") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
<html lang="en">
  <head>
    <title>Signal Inbox article with embedded video</title>
    <meta property="og:type" content="article" />
    <meta property="og:title" content="Signal Inbox article with embedded video" />
    <meta property="og:description" content="This article includes an embedded video, but the primary review target remains the article." />
    <meta property="og:image" content="http://127.0.0.1/article-cover.jpg" />
  </head>
  <body>
    <article>
      <h1>Signal Inbox article with embedded video</h1>
      <p>This article body is intentionally long enough to remain an article after normalization.</p>
      <p>It captures the case where a written page includes a supporting media block without changing the primary review target.</p>
      <video controls poster="/embedded-poster.jpg"><source src="/embedded-video.mp4" type="video/mp4" /></video>
      <p>Additional article paragraphs ensure Readability can still recover a normal article-shaped document with stable body text.</p>
    </article>
  </body>
</html>`);
      return;
    }

    if (request.url === "/video") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
<html lang="en">
  <head>
    <title>Signal Inbox smoke video</title>
    <meta property="og:type" content="video.other" />
    <meta property="og:title" content="Signal Inbox smoke video" />
    <meta property="og:description" content="This video page validates first-class video capture through the shared pipeline." />
    <meta property="og:image" content="http://127.0.0.1/thumbnail.jpg" />
    <meta property="og:video:url" content="http://127.0.0.1/embed/smoke-video" />
    <meta property="og:video:duration" content="213" />
    <meta property="og:site_name" content="Local Video Host" />
    <meta name="author" content="Signal Inbox Channel" />
  </head>
  <body>
    <main>
      <h1>Signal Inbox smoke video</h1>
      <p>This page acts like a video destination rather than an article.</p>
    </main>
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

  const articleUrl = `http://127.0.0.1:${address.port}/article-with-embedded-video`;
  const videoUrl = `http://127.0.0.1:${address.port}/video`;

  try {
    const articleResult = await runSubmittedUrlIngestJob({
      databaseUrl,
      normalizeRawAssetJobRunner: ({ databaseUrl: jobDatabaseUrl, rawAssetId }) =>
        runNormalizeRawAssetJob({
          databaseUrl: jobDatabaseUrl,
          processItemJobRunner: ({ databaseUrl: processDatabaseUrl, itemId }) =>
            runProcessItemJob({
              databaseUrl: processDatabaseUrl,
              itemId,
              knowledgeEnrichmentRunner,
            }),
          rawAssetId,
        }),
      submittedUrl: articleUrl,
      triggerRef: "core-smoke:url-embedded-video-article-ingest",
    });
    const videoResult = await runSubmittedUrlIngestJob({
      databaseUrl,
      normalizeRawAssetJobRunner: ({ databaseUrl: jobDatabaseUrl, rawAssetId }) =>
        runNormalizeRawAssetJob({
          databaseUrl: jobDatabaseUrl,
          processItemJobRunner: ({ databaseUrl: processDatabaseUrl, itemId }) =>
            runProcessItemJob({
              databaseUrl: processDatabaseUrl,
              itemId,
              knowledgeEnrichmentRunner,
            }),
          rawAssetId,
        }),
      submittedUrl: videoUrl,
      triggerRef: "core-smoke:url-video-ingest",
    });

    assert.equal(articleResult.rawAssetIds.length, 1);
    assert.equal(articleResult.normalizedItemIds.length, 1);
    assert.equal(articleResult.processedItemIds.length, 1);
    assert.equal(videoResult.rawAssetIds.length, 1);
    assert.equal(videoResult.normalizedItemIds.length, 1);
    assert.equal(videoResult.processedItemIds.length, 1);

    const sqlClient = createClient(databaseUrl);
    const db = createDbFromClient(sqlClient);

    try {
      const [articleCaptureEntry] = await db
        .select()
        .from(captureEntries)
        .where(eq(captureEntries.id, articleResult.captureEntryId));
      const [articleRawAsset] = await db
        .select()
        .from(rawAssets)
        .where(eq(rawAssets.id, articleResult.rawAssetIds[0]!));
      const [articleItem] = await db
        .select()
        .from(items)
        .where(eq(items.id, articleResult.normalizedItemIds[0]!));
      const [videoCaptureEntry] = await db
        .select()
        .from(captureEntries)
        .where(eq(captureEntries.id, videoResult.captureEntryId));

      const [videoRawAsset] = await db
        .select()
        .from(rawAssets)
        .where(eq(rawAssets.id, videoResult.rawAssetIds[0]!));
      const [videoItem] = await db
        .select()
        .from(items)
        .where(eq(items.id, videoResult.normalizedItemIds[0]!));

      assert.equal(articleCaptureEntry?.entryType, "url_submission");
      assert.equal(articleCaptureEntry?.status, "normalized");
      assert.equal(articleRawAsset?.status, "normalized");
      assert.equal(articleRawAsset?.assetType, "article");
      assert.equal(articleItem?.itemType, "article");
      assert.equal(articleItem?.canonicalUrl, articleUrl);
      assert.equal(articleItem?.title, "Signal Inbox article with embedded video");
      assert.equal(articleItem?.metadata.video, null);
      assert.equal(videoCaptureEntry?.entryType, "url_submission");
      assert.equal(videoCaptureEntry?.status, "normalized");
      assert.equal(videoRawAsset?.status, "normalized");
      assert.equal(videoRawAsset?.assetType, "video");
      assert.equal(videoItem?.itemType, "video");
      assert.equal(videoItem?.canonicalUrl, videoUrl);
      assert.equal(videoItem?.title, "Signal Inbox smoke video");
      assert.deepEqual(videoItem?.metadata.video, {
        creatorName: "Signal Inbox Channel",
        creatorUrl: null,
        description: "This video page validates first-class video capture through the shared pipeline.",
        durationLabel: "3:33",
        durationSeconds: 213,
        embedUrl: "http://127.0.0.1/embed/smoke-video",
        platform: "web",
        targetUrl: videoUrl,
        thumbnailUrl: "http://127.0.0.1/thumbnail.jpg",
      });
    } finally {
      await sqlClient.end();
    }
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

function buildSmokeKnowledgeEnrichmentRunner(): KnowledgeEnrichmentRunner {
  return async ({ config, item }) => ({
    config,
    output: {
      classification: {
        label: item.contentText?.includes("Video title:") ? "video" : "research",
        topic: item.title,
      },
      importanceScore: 0.79,
      keyPoints: [
        "Smoke coverage validates submitted URL capture into the shared pipeline.",
        "Normalization keeps enough metadata for downstream review surfaces.",
        "The Inbox can rely on processed output instead of raw link handling.",
      ],
      noteDraft: null,
      noveltyScore: 0.74,
      preserveRecommendation: "review",
      summary: {
        long: item.contentText,
        short: item.contentText?.includes("Video title:")
          ? "Video item retains platform, creator, and duration metadata for review."
          : "Direct URL ingest remains normalized through the shared processing path.",
      },
      tags: item.contentText?.includes("Video title:") ? ["video", "smoke-test"] : ["article", "smoke-test"],
      whyItMatters: "This smoke path verifies the shared capture, normalization, and processing contract.",
    },
  });
}

await main();
