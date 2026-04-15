import {
  beginSubmittedUrlExecution,
  completeSubmittedUrlExecution,
  failSubmittedUrlExecution,
  normalizeSubmittedUrl,
  SubmittedUrlValidationError,
} from "@signal-inbox/capture";
import { fetchSubmittedUrlAsset, SubmittedUrlConnectorError } from "@signal-inbox/connectors";

import { runNormalizeRawAssetJob } from "./normalize-raw-asset-job";

export interface RunSubmittedUrlIngestJobInput {
  databaseUrl?: string;
  normalizeRawAssetJobRunner?: (input: {
    databaseUrl?: string;
    rawAssetId: string;
  }) => ReturnType<typeof runNormalizeRawAssetJob>;
  submittedUrl: string;
  triggerRef?: string | null;
}

export class SubmittedUrlIngestJobError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "SubmittedUrlIngestJobError";
    this.cause = options?.cause;
  }

  declare cause?: unknown;
}

export class SubmittedUrlIngestPostProcessingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "SubmittedUrlIngestPostProcessingError";
    this.cause = options?.cause;
  }

  declare cause?: unknown;
}

export async function runSubmittedUrlIngestJob(input: RunSubmittedUrlIngestJobInput) {
  const submittedUrl = normalizeSubmittedUrl(input.submittedUrl);

  console.info("submitted url ingest started", {
    job_type: "url-ingest",
    submitted_url: submittedUrl,
  });

  const execution = await beginSubmittedUrlExecution(
    {
      submittedUrl,
      triggerRef: input.triggerRef,
    },
    input.databaseUrl,
  );
  const normalizeRawAssetJobRunner = input.normalizeRawAssetJobRunner ?? runNormalizeRawAssetJob;

  try {
    const connectorResult = await fetchSubmittedUrlAsset({
      submittedUrl: execution.submittedUrl,
    });
    const result = await completeSubmittedUrlExecution(
      {
        captureEntryId: execution.captureEntryId,
        connectorResult,
      },
      input.databaseUrl,
    );
    const normalizedItemIds: string[] = [];
    const processedItemIds: string[] = [];

    for (const rawAssetId of result.rawAssetIds) {
      try {
        const normalizedResult = await normalizeRawAssetJobRunner({
          databaseUrl: input.databaseUrl,
          rawAssetId,
        });

        normalizedItemIds.push(normalizedResult.itemId);
        processedItemIds.push(normalizedResult.processedItemId);
      } catch (error) {
        const causeMessage =
          error instanceof Error && error.message
            ? error.message
            : "Post-capture processing failed.";

        console.error("submitted url post-capture processing failed", {
          capture_entry_id: result.captureEntryId,
          job_type: "url-ingest",
          message: causeMessage,
          raw_asset_id: rawAssetId,
          status: "failed",
          submitted_url: execution.submittedUrl,
        });

        throw new SubmittedUrlIngestPostProcessingError(
          `Post-capture processing failed for ${execution.submittedUrl} on raw asset ${rawAssetId}: ${causeMessage}`,
          {
            cause: error,
          },
        );
      }
    }

    console.info("submitted url ingest succeeded", {
      capture_entry_id: result.captureEntryId,
      job_type: "url-ingest",
      normalized_item_count: normalizedItemIds.length,
      processed_item_count: processedItemIds.length,
      raw_asset_count: result.rawAssetIds.length,
      status: "processed",
      submitted_url: execution.submittedUrl,
    });

    return {
      ...result,
      normalizedItemIds,
      processedItemIds,
    };
  } catch (error) {
    if (error instanceof SubmittedUrlIngestPostProcessingError) {
      throw error;
    }

    const failure = await failSubmittedUrlExecution(
      {
        captureEntryId: execution.captureEntryId,
        error,
        metadata: {
          ...(error instanceof SubmittedUrlConnectorError ? error.details : null),
          submittedUrl: execution.submittedUrl,
        },
        rawAsset: buildFailureRawAsset(error, execution.submittedUrl),
      },
      input.databaseUrl,
    );

    console.error("submitted url ingest failed", {
      capture_entry_id: failure.captureEntryId,
      job_type: "url-ingest",
      message: failure.message,
      raw_asset_count: failure.rawAssetIds.length,
      status: "failed",
      submitted_url: execution.submittedUrl,
    });

    if (error instanceof SubmittedUrlValidationError) {
      throw error;
    }

    throw new SubmittedUrlIngestJobError(
      `Submitted URL ingest failed for ${execution.submittedUrl}: ${failure.message}`,
      {
        cause: error,
      },
    );
  }
}

function buildFailureRawAsset(error: unknown, submittedUrl: string) {
  if (!(error instanceof SubmittedUrlConnectorError)) {
    return undefined;
  }

  if (!error.details.bodyHtml && !error.details.bodyText) {
    return undefined;
  }

  return {
    assetType: error.details.contentType?.toLowerCase().startsWith("video/") ? ("video" as const) : ("url" as const),
    rawContent: error.details.bodyHtml ?? error.details.bodyText ?? null,
    rawMetadata: {
      ...error.details,
      connectorType: "submitted_url",
      submittedUrl,
    },
    url: error.details.finalUrl || submittedUrl,
  };
}
