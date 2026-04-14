import assert from "node:assert/strict";
import http from "node:http";

import { eq } from "drizzle-orm";

import { createDbFromClient, createSqlClient, createSqlClient as createClient, items, rawAssets } from "@signal-inbox/db";

import { runSubmittedUrlIngestJob } from "./url-ingest-job";

import { runMigrations } from "../../db/src/migrate";
import { captureEntries, startTemporaryPostgres } from "../../db/src";

async function main() {
  const temporaryPostgres = process.env.DATABASE_URL ? null : await startTemporaryPostgres();
  const databaseUrl = temporaryPostgres?.databaseUrl ?? process.env.DATABASE_URL;

  assert.ok(databaseUrl, "DATABASE_URL must be set or a temporary PostgreSQL instance must start.");

  try {
    await runMigrations(databaseUrl);
    await runUrlIngestSmokeTest(databaseUrl);
    console.log("URL ingest smoke test passed.");
  } finally {
    await temporaryPostgres?.cleanup();
  }
}

async function runUrlIngestSmokeTest(databaseUrl: string) {
  const server = http.createServer((request, response) => {
    if (request.url === "/article") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
<html lang="en">
  <head>
    <title>Signal Inbox URL ingest smoke article</title>
    <meta property="article:published_time" content="2026-04-14T03:00:00.000Z" />
  </head>
  <body>
    <article>
      <h1>Signal Inbox URL ingest smoke article</h1>
      <p>This article exists to validate direct URL capture into the shared pipeline.</p>
      <p>It should produce a CaptureEntry, RawAsset, Item, and downstream processing records.</p>
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

  const submittedUrl = `http://127.0.0.1:${address.port}/article`;

  try {
    const result = await runSubmittedUrlIngestJob({
      databaseUrl,
      submittedUrl,
      triggerRef: "core-smoke:url-ingest",
    });

    assert.equal(result.rawAssetIds.length, 1);
    assert.equal(result.normalizedItemIds.length, 1);
    assert.equal(result.processedItemIds.length, 1);

    const sqlClient = createClient(databaseUrl);
    const db = createDbFromClient(sqlClient);

    try {
      const [captureEntry] = await db
        .select()
        .from(captureEntries)
        .where(eq(captureEntries.id, result.captureEntryId));
      const [rawAsset] = await db
        .select()
        .from(rawAssets)
        .where(eq(rawAssets.id, result.rawAssetIds[0]!));
      const [item] = await db
        .select()
        .from(items)
        .where(eq(items.id, result.normalizedItemIds[0]!));

      assert.equal(captureEntry?.entryType, "url_submission");
      assert.equal(captureEntry?.status, "normalized");
      assert.equal(rawAsset?.status, "normalized");
      assert.equal(item?.canonicalUrl, submittedUrl);
      assert.equal(item?.title, "Signal Inbox URL ingest smoke article");
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

await main();
