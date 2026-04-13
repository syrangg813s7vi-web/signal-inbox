import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { desc, eq } from "drizzle-orm";

import { createRssSource, getRssSource } from "@signal-inbox/capture";
import {
  captureEntries,
  createDbFromClient,
  createSqlClient,
  rawAssets,
  runMigrations,
  sourceSyncState,
  startTemporaryPostgres,
} from "@signal-inbox/db";

import { runRssSourceSyncJob, SourceSyncJobError } from "./capture-sync-job";

async function main() {
  const temporaryPostgres = process.env.DATABASE_URL ? null : await startTemporaryPostgres();
  const databaseUrl = temporaryPostgres?.databaseUrl ?? process.env.DATABASE_URL;

  assert.ok(databaseUrl, "DATABASE_URL must be set or a temporary PostgreSQL instance must start.");

  const feedState = {
    mode: "success" as "success" | "failure",
    xml: buildRssFeed([
      {
        description: "First article description",
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
    if (request.url !== "/feed.xml") {
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

  try {
    await runMigrations(databaseUrl);
    await runSmokeTest(databaseUrl, sourceUrl, feedState);
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

  let dbClient = createSqlClient(databaseUrl);
  let db = createDbFromClient(dbClient);

  try {
    const [syncStateAfterFirstRun] = await db
      .select()
      .from(sourceSyncState)
      .where(eq(sourceSyncState.sourceId, createdSource.id));
    const rawAssetsAfterFirstRun = await db.select().from(rawAssets);

    assert.ok(syncStateAfterFirstRun);
    assert.ok(syncStateAfterFirstRun.lastSyncedAt);
    assert.ok(syncStateAfterFirstRun.lastSuccessAt);
    assert.equal(syncStateAfterFirstRun.lastErrorAt, null);
    assert.equal(syncStateAfterFirstRun.lastErrorMessage, null);
    assert.equal(rawAssetsAfterFirstRun.length, 2);
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
    const [finalSyncState] = await db
      .select()
      .from(sourceSyncState)
      .where(eq(sourceSyncState.sourceId, createdSource.id));
    const finalSource = await getRssSource(createdSource.id, databaseUrl);

    assert.equal(captureEntryRows.length, 4);
    assert.equal(captureEntryRows[0]?.status, "failed");
    assert.equal(captureEntryRows[1]?.status, "captured");
    assert.equal(rawAssetRows.length, 3);
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
        ${itemMarkup}
      </channel>
    </rss>`;
}

await main();
