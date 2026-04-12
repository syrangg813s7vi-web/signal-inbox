import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

import {
  captureEntries,
  createDbFromClient,
  createSqlClient,
  enrichments,
  itemGroupMembers,
  itemGroups,
  items,
  rawAssets,
  sources,
} from "./index";
import { runMigrations } from "./migrate";

const execFile = promisify(execFileCallback);

interface TempPostgresInstance {
  cleanup: () => Promise<void>;
  databaseUrl: string;
}

type PostgresErrorLike = Error & {
  cause?: unknown;
  code?: string;
  constraint?: string;
  constraint_name?: string;
};

async function main() {
  const tempInstance = process.env.DATABASE_URL ? null : await startTempPostgres();
  const databaseUrl = tempInstance?.databaseUrl ?? process.env.DATABASE_URL;

  assert.ok(databaseUrl, "DATABASE_URL must be set or a temporary PostgreSQL instance must start.");

  process.env.DATABASE_URL = databaseUrl;

  try {
    await runMigrations(databaseUrl);
    await runSmokeTest(databaseUrl);
    console.log("Database smoke test passed.");
  } finally {
    await tempInstance?.cleanup();
  }
}

async function runSmokeTest(databaseUrl: string) {
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const capturedAt = new Date("2026-04-12T00:00:00.000Z");
  const runId = randomUUID();
  const sourceRef = `rss:ai-feed:${runId}`;
  const articleUrl = `https://example.com/articles/${runId}`;

  try {
    const [source] = await db
      .insert(sources)
      .values({
        name: "AI Feed",
        sourceRef,
        sourceType: "rss",
        sourceUrl: "https://example.com/feed.xml",
        topic: "AI",
      })
      .returning({ id: sources.id });

    const [captureEntry] = await db
      .insert(captureEntries)
      .values({
        capturedAt,
        entryType: "source_sync",
        sourceId: source.id,
        triggerRef: "entry-001",
      })
      .returning({ id: captureEntries.id, sourceId: captureEntries.sourceId });

    const [rawAsset] = await db
      .insert(rawAssets)
      .values({
        assetType: "article",
        author: "Signal Inbox",
        captureEntryId: captureEntry.id,
        publishedAt: capturedAt,
        rawContent: "raw article content",
        title: "A useful article",
        url: articleUrl,
      })
      .returning({ captureEntryId: rawAssets.captureEntryId, id: rawAssets.id });

    const [item] = await db
      .insert(items)
      .values({
        canonicalUrl: articleUrl,
        contentText: "normalized article content",
        itemType: "article",
        publishedAt: capturedAt,
        rawAssetId: rawAsset.id,
        title: "A useful article",
      })
      .returning({ id: items.id, rawAssetId: items.rawAssetId });

    const [enrichment] = await db
      .insert(enrichments)
      .values({
        classification: "research",
        importanceScore: 0.9,
        itemId: item.id,
        noveltyScore: 0.6,
        summaryShort: "Short summary",
        topic: "AI",
      })
      .returning({ id: enrichments.id, itemId: enrichments.itemId });

    const [itemGroup] = await db
      .insert(itemGroups)
      .values({
        groupType: "topic",
        summary: "Grouped AI items",
        tag: "ai",
        title: "AI topic",
      })
      .returning({ id: itemGroups.id });

    const [member] = await db
      .insert(itemGroupMembers)
      .values({
        groupId: itemGroup.id,
        itemId: item.id,
      })
      .returning({ groupId: itemGroupMembers.groupId, itemId: itemGroupMembers.itemId });

    assert.equal(captureEntry.sourceId, source.id);
    assert.equal(rawAsset.captureEntryId, captureEntry.id);
    assert.equal(item.rawAssetId, rawAsset.id);
    assert.equal(enrichment.itemId, item.id);
    assert.equal(member.groupId, itemGroup.id);
    assert.equal(member.itemId, item.id);

    await expectPostgresError(
      () =>
        db.insert(sources).values({
          name: "Duplicate AI Feed",
          sourceRef,
          sourceType: "rss",
        }),
      "23505",
      "sources_source_type_source_ref_key",
    );

    await expectPostgresError(
      () =>
        db.insert(rawAssets).values({
          assetType: "article",
          captureEntryId: randomUUID(),
        }),
      "23503",
      "raw_assets_capture_entry_id_capture_entries_id_fk",
    );
  } finally {
    await client.end();
  }
}

async function expectPostgresError(
  operation: () => Promise<unknown>,
  expectedCode: string,
  expectedConstraint: string,
) {
  try {
    await operation();
  } catch (error) {
    const postgresError = unwrapPostgresError(error);

    assert.equal(postgresError.code, expectedCode);
    assert.equal(postgresError.constraint_name ?? postgresError.constraint, expectedConstraint);
    return;
  }

  assert.fail(`Expected PostgreSQL error ${expectedCode} for ${expectedConstraint}.`);
}

function unwrapPostgresError(error: unknown): PostgresErrorLike {
  let current = error;

  while (current && typeof current === "object") {
    const postgresError = current as PostgresErrorLike;

    if (postgresError.code || postgresError.constraint || postgresError.constraint_name) {
      return postgresError;
    }

    current = postgresError.cause;
  }

  return (error as PostgresErrorLike) ?? new Error("Unknown PostgreSQL error.");
}

async function startTempPostgres(): Promise<TempPostgresInstance> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "signal-inbox-db-smoke-"));
  const dataDir = path.join(tempRoot, "data");
  const logFile = path.join(tempRoot, "postgres.log");
  const port = await getFreePort();
  const databaseName = "signal_inbox_smoke";

  try {
    await execFile("initdb", ["-D", dataDir, "-A", "trust", "-U", "postgres"], {
      env: process.env,
    });
    await execFile("pg_ctl", ["-D", dataDir, "-l", logFile, "-o", `-F -p ${port}`, "start"], {
      env: process.env,
    });
    await execFile("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", databaseName], {
      env: process.env,
    });

    return {
      cleanup: async () => {
        try {
          await execFile("pg_ctl", ["-D", dataDir, "stop", "-m", "fast"], {
            env: process.env,
          });
        } finally {
          await rm(tempRoot, { force: true, recursive: true });
        }
      },
      databaseUrl: `postgresql://postgres@127.0.0.1:${port}/${databaseName}`,
    };
  } catch (error) {
    await rm(tempRoot, { force: true, recursive: true });
    throw error;
  }
}

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate a free TCP port for PostgreSQL.")));
        return;
      }

      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

await main();
