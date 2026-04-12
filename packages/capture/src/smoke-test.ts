import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createRssSource,
  deleteSource,
  listRssSources,
  pauseSource,
  reactivateSource,
  SourceNotFoundError,
} from "./index";

import { createDbFromClient, createSqlClient, sources } from "../../db/src";
import { runMigrations } from "../../db/src/migrate";
import { startTemporaryPostgres } from "../../db/src/testing";

async function main() {
  const temporaryPostgres = process.env.DATABASE_URL ? null : await startTemporaryPostgres();
  const databaseUrl = temporaryPostgres?.databaseUrl ?? process.env.DATABASE_URL;

  assert.ok(databaseUrl, "DATABASE_URL must be set or a temporary PostgreSQL instance must start.");

  try {
    await runMigrations(databaseUrl);
    await runCaptureSmokeTest(databaseUrl);
    console.log("Capture smoke test passed.");
  } finally {
    await temporaryPostgres?.cleanup();
  }
}

async function runCaptureSmokeTest(databaseUrl: string) {
  const sourceUrl = `https://example.com/feed-${randomUUID()}.xml`;

  const createdSource = await createRssSource(
    {
      name: "AI Research Feed",
      sourceUrl,
      topic: "AI",
    },
    databaseUrl,
  );

  assert.equal(createdSource.status, "active");
  assert.equal(createdSource.sourceUrl, sourceUrl);
  assert.notEqual(createdSource.syncState, null);
  assert.equal(createdSource.syncState?.lastSyncedAt ?? null, null);

  const sourcesAfterCreate = await listRssSources(databaseUrl);
  assert.equal(sourcesAfterCreate.length, 1);
  assert.equal(sourcesAfterCreate[0]?.id, createdSource.id);
  assert.equal(sourcesAfterCreate[0]?.status, "active");
  assert.notEqual(sourcesAfterCreate[0]?.syncState, null);

  const pausedSource = await pauseSource(createdSource.id, databaseUrl);
  assert.equal(pausedSource.status, "paused");
  assert.notEqual(pausedSource.syncState, null);

  const sourcesAfterPause = await listRssSources(databaseUrl);
  assert.equal(sourcesAfterPause[0]?.status, "paused");
  assert.notEqual(sourcesAfterPause[0]?.syncState, null);

  const reactivatedSource = await reactivateSource(createdSource.id, databaseUrl);
  assert.equal(reactivatedSource.status, "active");
  assert.notEqual(reactivatedSource.syncState, null);

  const sourcesAfterReactivate = await listRssSources(databaseUrl);
  assert.equal(sourcesAfterReactivate[0]?.status, "active");
  assert.notEqual(sourcesAfterReactivate[0]?.syncState, null);

  await expectSourceValidationError(
    () => pauseSource("", databaseUrl),
    "Source id is required.",
  );

  await expectSourceNotFoundError(
    () => reactivateSource(randomUUID(), databaseUrl),
    "Source not found.",
  );

  await expectSourceNotFoundError(
    () => deleteSource(randomUUID(), databaseUrl),
    "Source not found.",
  );

  await expectSourceValidationError(
    () =>
      createRssSource(
        {
          name: "Invalid Feed",
          sourceUrl: "ftp://example.com/feed.xml",
        },
        databaseUrl,
      ),
    "RSS URLs must use http or https.",
  );

  await expectSourceConflictError(
    () =>
      createRssSource(
        {
          name: "Duplicate Feed",
          sourceUrl,
        },
        databaseUrl,
      ),
    "That RSS source is already registered.",
  );

  await deleteSource(createdSource.id, databaseUrl);

  const sourcesAfterDelete = await listRssSources(databaseUrl);
  assert.equal(sourcesAfterDelete.length, 0);

  const orphanedSourceId = randomUUID();
  const sqlClient = createSqlClient(databaseUrl);
  const db = createDbFromClient(sqlClient);

  try {
    await db.insert(sources).values({
      id: orphanedSourceId,
      name: "Legacy RSS Feed",
      sourceRef: `https://example.com/legacy-${randomUUID()}.xml`,
      sourceType: "rss",
      sourceUrl: `https://example.com/legacy-${randomUUID()}.xml`,
      status: "active",
    });
  } finally {
    await sqlClient.end();
  }

  const legacyListedSource = (await listRssSources(databaseUrl)).find(
    (source) => source.id === orphanedSourceId,
  );
  assert.notEqual(legacyListedSource, undefined);
  assert.notEqual(legacyListedSource?.syncState, null);

  const pausedLegacySource = await pauseSource(orphanedSourceId, databaseUrl);
  assert.equal(pausedLegacySource.status, "paused");
  assert.notEqual(pausedLegacySource.syncState, null);

  await deleteSource(orphanedSourceId, databaseUrl);
}

async function expectSourceValidationError(
  operation: () => Promise<unknown>,
  expectedMessage: string,
) {
  try {
    await operation();
  } catch (error) {
    assert.equal(readErrorMessage(error), expectedMessage);
    return;
  }

  assert.fail(`Expected SourceValidationError with message: ${expectedMessage}`);
}

async function expectSourceConflictError(operation: () => Promise<unknown>, expectedMessage: string) {
  try {
    await operation();
  } catch (error) {
    assert.equal(readErrorMessage(error), expectedMessage);
    return;
  }

  assert.fail(`Expected SourceConflictError with message: ${expectedMessage}`);
}

async function expectSourceNotFoundError(operation: () => Promise<unknown>, expectedMessage: string) {
  try {
    await operation();
  } catch (error) {
    assert.ok(error instanceof SourceNotFoundError);
    assert.equal(error.message, expectedMessage);
    return;
  }

  assert.fail(`Expected SourceNotFoundError with message: ${expectedMessage}`);
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

await main();
