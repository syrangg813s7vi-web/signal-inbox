import { and, eq, inArray, or } from "drizzle-orm";

import {
  captureEntries,
  createDbFromClient,
  createSqlClient,
  rawAssets,
  sourceSyncState,
  sources,
} from "@signal-inbox/db";
import type { RssFeedFetchResult } from "@signal-inbox/connectors";

export interface BeginSourceSyncExecutionInput {
  sourceId: string;
  triggerRef?: string | null;
}

export interface SourceSyncExecutionRecord {
  captureEntryId: string;
  capturedAt: Date;
  sourceId: string;
  triggerRef: string | null;
}

export interface CompleteRssSourceSyncExecutionInput {
  captureEntryId: string;
  sourceId: string;
  connectorResult: RssFeedFetchResult;
}

export interface SourceSyncSuccessResult {
  captureEntryId: string;
  cursor: string | null;
  fetchedCount: number;
  persistedCount: number;
  rawAssetIds: string[];
  skippedCount: number;
  sourceId: string;
}

export interface SourceSyncFailureResult {
  captureEntryId: string;
  message: string;
  sourceId: string;
}

export class SourceSyncValidationError extends Error {}

interface SourceSyncCursor {
  latestExternalIds: string[];
  latestPublishedAt: string | null;
  latestUrls: string[];
}

export async function beginSourceSyncExecution(
  input: BeginSourceSyncExecutionInput,
  databaseUrl?: string,
): Promise<SourceSyncExecutionRecord> {
  const sourceId = input.sourceId.trim();

  if (!sourceId) {
    throw new SourceSyncValidationError("Source id is required.");
  }

  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const capturedAt = new Date();

  try {
    await db.insert(sourceSyncState).values({ sourceId }).onConflictDoNothing();

    const [captureEntry] = await db
      .insert(captureEntries)
      .values({
        capturedAt,
        entryType: "source_sync",
        metadata: {
          connectorType: "rss",
          phase: "started",
        },
        sourceId,
        triggerRef: input.triggerRef?.trim() || null,
      })
      .returning({ id: captureEntries.id, triggerRef: captureEntries.triggerRef });

    return {
      captureEntryId: captureEntry.id,
      capturedAt,
      sourceId,
      triggerRef: captureEntry.triggerRef,
    };
  } finally {
    await client.end();
  }
}

export async function completeRssSourceSyncExecution(
  input: CompleteRssSourceSyncExecutionInput,
  databaseUrl?: string,
): Promise<SourceSyncSuccessResult> {
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const completedAt = new Date();

  try {
    const result = await db.transaction(async (tx) => {
      const existingIdentitySet = await loadExistingAssetIdentitySet(
        input.connectorResult.items,
        async (externalIds, urls) => {
          const conditions = [];

          if (externalIds.length > 0) {
            conditions.push(inArray(rawAssets.externalId, externalIds));
          }

          if (urls.length > 0) {
            conditions.push(inArray(rawAssets.url, urls));
          }

          if (conditions.length === 0) {
            return [];
          }

          return tx
            .select({
              externalId: rawAssets.externalId,
              url: rawAssets.url,
            })
            .from(rawAssets)
            .innerJoin(captureEntries, eq(captureEntries.id, rawAssets.captureEntryId))
            .where(and(eq(captureEntries.sourceId, input.sourceId), or(...conditions)));
        },
      );
      const syncedIdentitySet = new Set(existingIdentitySet);
      const newAssets = input.connectorResult.items.filter((item) => {
        if (hasKnownIdentity(syncedIdentitySet, item)) {
          return false;
        }

        rememberKnownIdentity(syncedIdentitySet, item);
        return true;
      });

      const insertedAssets =
        newAssets.length === 0
          ? []
          : await tx
              .insert(rawAssets)
              .values(
                newAssets.map((item) => ({
                  assetType: "article" as const,
                  author: item.author,
                  captureEntryId: input.captureEntryId,
                  externalId: item.externalId,
                  publishedAt: item.publishedAt,
                  rawContent: item.rawContent,
                  rawMetadata: {
                    ...item.rawMetadata,
                    connectorType: "rss",
                    fetchedAt: input.connectorResult.requestedAt.toISOString(),
                    feed: input.connectorResult.metadata,
                    finalUrl: input.connectorResult.finalUrl,
                    sourceUrl: input.connectorResult.sourceUrl,
                  },
                  title: item.title,
                  updatedAt: completedAt,
                  url: item.url,
                })),
              )
              .returning({ id: rawAssets.id });

      const nextCursor = serializeCursor(buildCursor(input.connectorResult.items));

      await tx
        .update(captureEntries)
        .set({
          metadata: {
            completedAt: completedAt.toISOString(),
            connectorType: "rss",
            fetchedCount: input.connectorResult.items.length,
            feed: input.connectorResult.metadata,
            finalUrl: input.connectorResult.finalUrl,
            normalization:
              insertedAssets.length === 0
                ? {
                    normalizedAt: completedAt.toISOString(),
                    phase: "skipped",
                    reason: "no_new_raw_assets",
                  }
                : undefined,
            persistedCount: insertedAssets.length,
            phase: "completed",
            skippedCount: input.connectorResult.items.length - insertedAssets.length,
            sourceUrl: input.connectorResult.sourceUrl,
          },
          status: insertedAssets.length === 0 ? "normalized" : "captured",
        })
        .where(eq(captureEntries.id, input.captureEntryId));

      await tx
        .update(sourceSyncState)
        .set({
          cursor: nextCursor,
          lastErrorAt: null,
          lastErrorMessage: null,
          lastSuccessAt: completedAt,
          lastSyncedAt: completedAt,
        })
        .where(eq(sourceSyncState.sourceId, input.sourceId));

      await tx
        .update(sources)
        .set({
          status: "active",
          updatedAt: completedAt,
        })
        .where(eq(sources.id, input.sourceId));

      return {
        cursor: nextCursor,
        rawAssetIds: insertedAssets.map((asset) => asset.id),
      };
    });

    return {
      captureEntryId: input.captureEntryId,
      cursor: result.cursor,
      fetchedCount: input.connectorResult.items.length,
      persistedCount: result.rawAssetIds.length,
      rawAssetIds: result.rawAssetIds,
      skippedCount: input.connectorResult.items.length - result.rawAssetIds.length,
      sourceId: input.sourceId,
    };
  } finally {
    await client.end();
  }
}

export async function failSourceSyncExecution(
  input: {
    captureEntryId: string;
    error: unknown;
    sourceId: string;
  },
  databaseUrl?: string,
): Promise<SourceSyncFailureResult> {
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const failedAt = new Date();
  const message = getErrorMessage(input.error);

  try {
    await db.transaction(async (tx) => {
      const [captureEntryRecord] = await tx
        .select({ metadata: captureEntries.metadata })
        .from(captureEntries)
        .where(eq(captureEntries.id, input.captureEntryId));

      await tx
        .update(captureEntries)
        .set({
          metadata: {
            ...(captureEntryRecord?.metadata ?? {}),
            failedAt: failedAt.toISOString(),
            message,
            phase: "failed",
          },
          status: "failed",
        })
        .where(eq(captureEntries.id, input.captureEntryId));

      await tx
        .update(sourceSyncState)
        .set({
          lastErrorAt: failedAt,
          lastErrorMessage: truncateErrorMessage(message),
          lastSyncedAt: failedAt,
        })
        .where(eq(sourceSyncState.sourceId, input.sourceId));

      await tx
        .update(sources)
        .set({
          status: "error",
          updatedAt: failedAt,
        })
        .where(eq(sources.id, input.sourceId));
    });

    return {
      captureEntryId: input.captureEntryId,
      message,
      sourceId: input.sourceId,
    };
  } finally {
    await client.end();
  }
}

async function loadExistingAssetIdentitySet(
  items: RssFeedFetchResult["items"],
  queryExistingRows: (
    externalIds: string[],
    urls: string[],
  ) => Promise<Array<{ externalId: string | null; url: string | null }>>,
): Promise<Set<string>> {
  const externalIds = uniqueNonEmpty(items.map((item) => item.externalId));
  const urls = uniqueNonEmpty(items.map((item) => item.url));
  const rows = await queryExistingRows(externalIds, urls);

  return new Set(
    rows.flatMap((row) => [
      row.externalId ? buildIdentityKey("externalId", row.externalId) : null,
      row.url ? buildIdentityKey("url", row.url) : null,
    ]).filter(isDefined),
  );
}

function hasKnownIdentity(
  identitySet: Set<string>,
  item: RssFeedFetchResult["items"][number],
): boolean {
  const keys = [
    item.externalId ? buildIdentityKey("externalId", item.externalId) : null,
    item.url ? buildIdentityKey("url", item.url) : null,
  ].filter(isDefined);

  return keys.some((key) => identitySet.has(key));
}

function rememberKnownIdentity(
  identitySet: Set<string>,
  item: RssFeedFetchResult["items"][number],
) {
  if (item.externalId) {
    identitySet.add(buildIdentityKey("externalId", item.externalId));
  }

  if (item.url) {
    identitySet.add(buildIdentityKey("url", item.url));
  }
}

function buildCursor(items: RssFeedFetchResult["items"]): SourceSyncCursor | null {
  if (items.length === 0) {
    return null;
  }

  const datedItems = items.filter((item) => item.publishedAt !== null);

  if (datedItems.length > 0) {
    const latestTimestamp = Math.max(...datedItems.map((item) => item.publishedAt!.getTime()));
    const latestPublishedAt = new Date(latestTimestamp).toISOString();
    const latestItems = datedItems.filter(
      (item) => item.publishedAt?.toISOString() === latestPublishedAt,
    );

    return {
      latestExternalIds: uniqueNonEmpty(latestItems.map((item) => item.externalId)),
      latestPublishedAt,
      latestUrls: uniqueNonEmpty(latestItems.map((item) => item.url)),
    };
  }

  const [firstItem] = items;

  if (!firstItem) {
    return null;
  }

  return {
    latestExternalIds: uniqueNonEmpty([firstItem.externalId]),
    latestPublishedAt: null,
    latestUrls: uniqueNonEmpty([firstItem.url]),
  };
}

function serializeCursor(cursor: SourceSyncCursor | null): string | null {
  if (!cursor) {
    return null;
  }

  return JSON.stringify(cursor);
}

function buildIdentityKey(kind: "externalId" | "url", value: string): string {
  return `${kind}:${value}`;
}

function uniqueNonEmpty(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function truncateErrorMessage(message: string): string {
  return message.length <= 500 ? message : `${message.slice(0, 497)}...`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}
