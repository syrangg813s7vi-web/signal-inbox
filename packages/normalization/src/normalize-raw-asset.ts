import { and, eq, ne } from "drizzle-orm";

import {
  captureEntries,
  createDbFromClient,
  createSqlClient,
  items,
  rawAssets,
} from "@signal-inbox/db";

export interface ItemNormalizationRecord {
  id: string;
  rawAssetId: string;
  status: "new" | "processed" | "archived";
}

export interface NormalizeRawAssetInput {
  rawAssetId: string;
}

export interface NormalizeRawAssetSuccessResult {
  captureEntryId: string;
  itemId: string;
  rawAssetId: string;
}

export interface NormalizeRawAssetFailureResult {
  captureEntryId: string;
  message: string;
  rawAssetId: string;
}

export interface RawAssetNormalizationContext {
  captureEntryId: string;
  rawAssetId: string;
}

interface RawAssetRecord {
  assetType: "url" | "article";
  author: string | null;
  captureEntryId: string;
  externalId: string | null;
  id: string;
  publishedAt: Date | null;
  rawContent: string | null;
  rawMetadata: Record<string, unknown>;
  status: "new" | "normalized" | "failed";
  title: string | null;
  url: string | null;
}

interface NormalizedItemDraft {
  author: string | null;
  canonicalUrl: string | null;
  contentText: string | null;
  itemType: "article";
  language: string | null;
  metadata: Record<string, unknown>;
  publishedAt: Date | null;
  title: string | null;
}

type PostgresErrorLike = Error & {
  cause?: unknown;
  code?: string;
  constraint?: string;
  constraint_name?: string;
};

type DatabaseTransaction = Parameters<
  Parameters<ReturnType<typeof createDbFromClient>["transaction"]>[0]
>[0];

const CANONICAL_URL_CONSTRAINT = "items_canonical_url_key";
const RAW_ASSET_ID_CONSTRAINT = "items_raw_asset_id_key";

export class RawAssetNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RawAssetNotFoundError";
  }
}

export class NormalizationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NormalizationValidationError";
  }
}

export async function normalizeRawAsset(
  input: NormalizeRawAssetInput,
  databaseUrl?: string,
): Promise<NormalizeRawAssetSuccessResult> {
  const rawAssetId = input.rawAssetId.trim();

  if (!rawAssetId) {
    throw new NormalizationValidationError("Raw asset id is required.");
  }

  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);

  try {
    try {
      return await runNormalizeRawAssetTransaction(db, rawAssetId, {
        forceCanonicalUrlFallback: false,
      });
    } catch (error) {
      if (!isRetriableNormalizationConstraintError(error)) {
        throw error;
      }

      return await runNormalizeRawAssetTransaction(db, rawAssetId, {
        forceCanonicalUrlFallback: true,
      });
    }
  } finally {
    await client.end();
  }
}

async function runNormalizeRawAssetTransaction(
  db: ReturnType<typeof createDbFromClient>,
  rawAssetId: string,
  options: {
    forceCanonicalUrlFallback: boolean;
  },
): Promise<NormalizeRawAssetSuccessResult> {
  const normalizedAt = new Date();

  return db.transaction(async (tx) => {
      const [rawAsset] = await tx
        .select({
          assetType: rawAssets.assetType,
          author: rawAssets.author,
          captureEntryId: rawAssets.captureEntryId,
          externalId: rawAssets.externalId,
          id: rawAssets.id,
          publishedAt: rawAssets.publishedAt,
          rawContent: rawAssets.rawContent,
          rawMetadata: rawAssets.rawMetadata,
          status: rawAssets.status,
          title: rawAssets.title,
          url: rawAssets.url,
        })
        .from(rawAssets)
        .where(eq(rawAssets.id, rawAssetId));

      if (!rawAsset) {
        throw new RawAssetNotFoundError(`Raw asset ${rawAssetId} was not found.`);
      }

      const [existingItem] = await tx
        .select({
          id: items.id,
          rawAssetId: items.rawAssetId,
          status: items.status,
        })
        .from(items)
        .where(eq(items.rawAssetId, rawAsset.id));

      if (existingItem) {
        await finalizeCaptureEntryStatus(tx, rawAsset.captureEntryId, normalizedAt);

        return {
          captureEntryId: rawAsset.captureEntryId,
          itemId: existingItem.id,
          rawAssetId: rawAsset.id,
        };
      }

      if (rawAsset.status === "failed") {
        throw new NormalizationValidationError(
          `Raw asset ${rawAsset.id} is marked failed and cannot be normalized.`,
        );
      }

      const normalizedItem = buildNormalizedItem(rawAsset, normalizedAt);
      const insertedItem = await insertNormalizedItem(tx, rawAsset.id, normalizedItem, normalizedAt, {
        forceCanonicalUrlFallback: options.forceCanonicalUrlFallback,
      });

      await tx
        .update(rawAssets)
        .set({
          status: "normalized",
          updatedAt: normalizedAt,
        })
        .where(eq(rawAssets.id, rawAsset.id));

      await finalizeCaptureEntryStatus(tx, rawAsset.captureEntryId, normalizedAt);

      return {
        captureEntryId: rawAsset.captureEntryId,
        itemId: insertedItem.id,
        rawAssetId: rawAsset.id,
      };
    });
}

export async function failRawAssetNormalization(
  input: NormalizeRawAssetFailureResult,
  databaseUrl?: string,
): Promise<NormalizeRawAssetFailureResult> {
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const failedAt = new Date();

  try {
    await db.transaction(async (tx) => {
      const [rawAssetRecord] = await tx
        .select({ rawMetadata: rawAssets.rawMetadata })
        .from(rawAssets)
        .where(eq(rawAssets.id, input.rawAssetId));
      const [captureEntryRecord] = await tx
        .select({ metadata: captureEntries.metadata })
        .from(captureEntries)
        .where(eq(captureEntries.id, input.captureEntryId));

      await tx
        .update(rawAssets)
        .set({
          rawMetadata: {
            ...(rawAssetRecord?.rawMetadata ?? {}),
            normalization: {
              failedAt: failedAt.toISOString(),
              message: input.message,
              phase: "failed",
            },
          },
          status: "failed",
          updatedAt: failedAt,
        })
        .where(eq(rawAssets.id, input.rawAssetId));

      await tx
        .update(captureEntries)
        .set({
          metadata: {
            ...(captureEntryRecord?.metadata ?? {}),
            normalization: {
              failedAt: failedAt.toISOString(),
              message: input.message,
              phase: "failed",
              rawAssetId: input.rawAssetId,
            },
          },
          status: "failed",
        })
        .where(eq(captureEntries.id, input.captureEntryId));
    });

    return input;
  } finally {
    await client.end();
  }
}

export async function getRawAssetNormalizationContext(
  rawAssetId: string,
  databaseUrl?: string,
): Promise<RawAssetNormalizationContext | null> {
  const trimmedRawAssetId = rawAssetId.trim();

  if (!trimmedRawAssetId) {
    return null;
  }

  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);

  try {
    const [rawAsset] = await db
      .select({
        captureEntryId: rawAssets.captureEntryId,
        rawAssetId: rawAssets.id,
      })
      .from(rawAssets)
      .where(eq(rawAssets.id, trimmedRawAssetId));

    return rawAsset ?? null;
  } finally {
    await client.end();
  }
}

function buildNormalizedItem(
  rawAsset: RawAssetRecord,
  normalizedAt: Date,
): NormalizedItemDraft {
  const contentText = extractContentText(rawAsset.rawContent);
  const feedMetadata = asRecord(rawAsset.rawMetadata.feed);
  const connectorType = readString(rawAsset.rawMetadata.connectorType);
  const language = firstNonEmpty([
    readString(rawAsset.rawMetadata.language),
    readString(feedMetadata?.language),
  ]);

  return {
    author: rawAsset.author,
    canonicalUrl: rawAsset.url,
    contentText,
    itemType: "article",
    language,
    metadata: {
      captureEntryId: rawAsset.captureEntryId,
      connectorType,
      externalId: rawAsset.externalId,
      normalizedAt: normalizedAt.toISOString(),
      rawAssetType: rawAsset.assetType,
      sourceUrl: readString(rawAsset.rawMetadata.sourceUrl),
      extraction: {
        contentLength: contentText?.length ?? 0,
        contentSource: rawAsset.rawContent ? "raw_content" : "metadata_only",
        textFormat: hasMarkup(rawAsset.rawContent) ? "html" : "text",
      },
      rss: {
        feedLanguage: readString(feedMetadata?.language),
        feedTitle: readString(feedMetadata?.title),
        feedUrl: readString(feedMetadata?.siteUrl),
      },
    },
    publishedAt: rawAsset.publishedAt,
    title: rawAsset.title,
  };
}

async function insertNormalizedItem(
  tx: DatabaseTransaction,
  rawAssetId: string,
  normalizedItem: NormalizedItemDraft,
  normalizedAt: Date,
  options: {
    forceCanonicalUrlFallback: boolean;
  },
) {
  const hasCanonicalUrlConflict = options.forceCanonicalUrlFallback
    ? true
    : normalizedItem.canonicalUrl
    ? await findExistingItemByCanonicalUrl(tx, normalizedItem.canonicalUrl)
    : false;

  const [insertedItem] = await tx
    .insert(items)
    .values({
      author: normalizedItem.author,
      canonicalUrl: hasCanonicalUrlConflict ? null : normalizedItem.canonicalUrl,
      contentText: normalizedItem.contentText,
      itemType: normalizedItem.itemType,
      language: normalizedItem.language,
      metadata: hasCanonicalUrlConflict
        ? {
            ...normalizedItem.metadata,
            canonicalUrlConflict: normalizedItem.canonicalUrl,
          }
        : normalizedItem.metadata,
      publishedAt: normalizedItem.publishedAt,
      rawAssetId,
      status: "new",
      title: normalizedItem.title,
      updatedAt: normalizedAt,
    })
    .returning({ id: items.id });

  return insertedItem;
}

async function finalizeCaptureEntryStatus(
  tx: DatabaseTransaction,
  captureEntryId: string,
  normalizedAt: Date,
) {
  const [remainingRawAsset] = await tx
    .select({ id: rawAssets.id })
    .from(rawAssets)
    .where(andCaptureEntryAndNotNormalized(captureEntryId))
    .limit(1);

  if (remainingRawAsset) {
    return;
  }

  const [captureEntryRecord] = await tx
    .select({ metadata: captureEntries.metadata })
    .from(captureEntries)
    .where(eq(captureEntries.id, captureEntryId));

  await tx
    .update(captureEntries)
    .set({
      metadata: {
        ...(captureEntryRecord?.metadata ?? {}),
        normalization: {
          normalizedAt: normalizedAt.toISOString(),
          phase: "completed",
        },
      },
      status: "normalized",
    })
    .where(eq(captureEntries.id, captureEntryId));
}

function andCaptureEntryAndNotNormalized(captureEntryId: string) {
  return and(eq(rawAssets.captureEntryId, captureEntryId), ne(rawAssets.status, "normalized"));
}

function extractContentText(rawContent: string | null): string | null {
  const trimmedContent = rawContent?.trim();

  if (!trimmedContent) {
    return null;
  }

  const withoutBlockTags = trimmedContent.replace(/<(\/?(?:p|div|section|article|br|li|ul|ol|h[1-6]))\b[^>]*>/gi, "\n");
  const withoutTags = withoutBlockTags.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(withoutTags);
  const normalizedWhitespace = decoded
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return normalizedWhitespace || null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function hasMarkup(value: string | null): boolean {
  return value ? /<[^>]+>/.test(value) : false;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstNonEmpty(values: Array<string | null>): string | null {
  return values.find((value) => Boolean(value)) ?? null;
}

async function findExistingItemByCanonicalUrl(
  tx: DatabaseTransaction,
  canonicalUrl: string,
): Promise<boolean> {
  const [existingItem] = await tx
    .select({ id: items.id })
    .from(items)
    .where(eq(items.canonicalUrl, canonicalUrl))
    .limit(1);

  return Boolean(existingItem);
}

function isConstraintError(error: unknown, expectedConstraint: string): boolean {
  const postgresError = unwrapPostgresError(error);

  return (
    postgresError.code === "23505" &&
    (postgresError.constraint_name ?? postgresError.constraint) === expectedConstraint
  );
}

function isRetriableNormalizationConstraintError(error: unknown): boolean {
  return (
    isConstraintError(error, CANONICAL_URL_CONSTRAINT) ||
    isConstraintError(error, RAW_ASSET_ID_CONSTRAINT)
  );
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
