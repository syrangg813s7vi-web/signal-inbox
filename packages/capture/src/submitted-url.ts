import { eq } from "drizzle-orm";

import { captureEntries, createDbFromClient, createSqlClient, rawAssets } from "@signal-inbox/db";
import type { SubmittedUrlArticleFetchResult, SubmittedUrlCaptureMetadata } from "@signal-inbox/connectors";

export interface BeginSubmittedUrlExecutionInput {
  submittedUrl: string;
  triggerRef?: string | null;
}

export interface SubmittedUrlExecutionRecord {
  captureEntryId: string;
  capturedAt: Date;
  submittedUrl: string;
  triggerRef: string | null;
}

export interface CompleteSubmittedUrlExecutionInput {
  captureEntryId: string;
  connectorResult: SubmittedUrlArticleFetchResult;
}

export interface SubmittedUrlSuccessResult {
  captureEntryId: string;
  persistedCount: number;
  rawAssetIds: string[];
  submittedUrl: string;
}

export interface SubmittedUrlFailureAssetInput {
  assetType: "article" | "url";
  author?: string | null;
  publishedAt?: Date | null;
  rawContent?: string | null;
  rawMetadata: Record<string, unknown>;
  title?: string | null;
  url?: string | null;
}

export interface SubmittedUrlFailureResult {
  captureEntryId: string;
  message: string;
  rawAssetIds: string[];
  submittedUrl: string;
}

export class SubmittedUrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubmittedUrlValidationError";
  }
}

export async function beginSubmittedUrlExecution(
  input: BeginSubmittedUrlExecutionInput,
  databaseUrl?: string,
): Promise<SubmittedUrlExecutionRecord> {
  const submittedUrl = normalizeSubmittedUrl(input.submittedUrl);
  const capturedAt = new Date();
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);

  try {
    const [captureEntry] = await db
      .insert(captureEntries)
      .values({
        capturedAt,
        entryType: "url_submission",
        metadata: {
          connectorType: "submitted_url",
          phase: "started",
          submittedUrl,
        },
        sourceId: null,
        triggerRef: input.triggerRef?.trim() || null,
      })
      .returning({ id: captureEntries.id, triggerRef: captureEntries.triggerRef });

    return {
      captureEntryId: captureEntry.id,
      capturedAt,
      submittedUrl,
      triggerRef: captureEntry.triggerRef,
    };
  } finally {
    await client.end();
  }
}

export async function completeSubmittedUrlExecution(
  input: CompleteSubmittedUrlExecutionInput,
  databaseUrl?: string,
): Promise<SubmittedUrlSuccessResult> {
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const completedAt = new Date();

  try {
    return await db.transaction(async (tx) => {
      const [rawAsset] = await tx
        .insert(rawAssets)
        .values({
          assetType: "article",
          author: input.connectorResult.author,
          captureEntryId: input.captureEntryId,
          publishedAt: input.connectorResult.publishedAt,
          rawContent: input.connectorResult.contentHtml,
          rawMetadata: buildSuccessRawAssetMetadata(input.connectorResult),
          title: input.connectorResult.title,
          updatedAt: completedAt,
          url: input.connectorResult.metadata.finalUrl,
        })
        .returning({ id: rawAssets.id });

      await tx
        .update(captureEntries)
        .set({
          metadata: {
            ...input.connectorResult.metadata,
            completedAt: completedAt.toISOString(),
            connectorType: "submitted_url",
            persistedCount: 1,
            phase: "completed",
          },
          status: "captured",
        })
        .where(eq(captureEntries.id, input.captureEntryId));

      return {
        captureEntryId: input.captureEntryId,
        persistedCount: 1,
        rawAssetIds: [rawAsset.id],
        submittedUrl: input.connectorResult.metadata.submittedUrl,
      };
    });
  } finally {
    await client.end();
  }
}

export async function failSubmittedUrlExecution(
  input: {
    captureEntryId: string;
    error: unknown;
    metadata: Partial<SubmittedUrlCaptureMetadata> & {
      submittedUrl: string;
    };
    rawAsset?: SubmittedUrlFailureAssetInput;
  },
  databaseUrl?: string,
): Promise<SubmittedUrlFailureResult> {
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const failedAt = new Date();
  const message = getErrorMessage(input.error);

  try {
    return await db.transaction(async (tx) => {
      const rawAssetIds: string[] = [];

      if (input.rawAsset) {
        const [rawAsset] = await tx
          .insert(rawAssets)
          .values({
            assetType: input.rawAsset.assetType,
            author: input.rawAsset.author ?? null,
            captureEntryId: input.captureEntryId,
            publishedAt: input.rawAsset.publishedAt ?? null,
            rawContent: input.rawAsset.rawContent ?? null,
            rawMetadata: {
              ...input.rawAsset.rawMetadata,
              failure: {
                failedAt: failedAt.toISOString(),
                message,
              },
            },
            status: "failed",
            title: input.rawAsset.title ?? null,
            updatedAt: failedAt,
            url: input.rawAsset.url ?? input.metadata.finalUrl ?? input.metadata.submittedUrl,
          })
          .returning({ id: rawAssets.id });

        rawAssetIds.push(rawAsset.id);
      }

      await tx
        .update(captureEntries)
        .set({
          metadata: {
            ...input.metadata,
            failedAt: failedAt.toISOString(),
            message,
            persistedCount: rawAssetIds.length,
            phase: "failed",
            rawAssetIds,
          },
          status: "failed",
        })
        .where(eq(captureEntries.id, input.captureEntryId));

      return {
        captureEntryId: input.captureEntryId,
        message,
        rawAssetIds,
        submittedUrl: input.metadata.submittedUrl,
      };
    });
  } finally {
    await client.end();
  }
}

export function normalizeSubmittedUrl(submittedUrl: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(submittedUrl.trim());
  } catch {
    throw new SubmittedUrlValidationError("Enter a valid article URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new SubmittedUrlValidationError("Submitted URLs must use http or https.");
  }

  parsedUrl.hash = "";
  return parsedUrl.toString();
}

function buildSuccessRawAssetMetadata(
  connectorResult: SubmittedUrlArticleFetchResult,
): Record<string, unknown> {
  return {
    ...connectorResult.metadata,
    connectorType: "submitted_url",
    contentTextLength: connectorResult.contentText.length,
    excerpt: connectorResult.excerpt,
    language: connectorResult.language,
    siteName: connectorResult.siteName,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Submitted URL ingest failed.";
}
