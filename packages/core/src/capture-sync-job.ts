import {
  beginSourceSyncExecution,
  completeRssSourceSyncExecution,
  failSourceSyncExecution,
  getRssSource,
  SourceNotFoundError,
  SourceSyncValidationError,
} from "@signal-inbox/capture";
import { fetchRssFeed } from "@signal-inbox/connectors";

import { runNormalizeRawAssetJob } from "./normalize-raw-asset-job";

export interface RunRssSourceSyncJobInput {
  sourceId: string;
  triggerRef?: string | null;
  databaseUrl?: string;
  normalizeRawAssetJobRunner?: (input: {
    databaseUrl?: string;
    rawAssetId: string;
  }) => ReturnType<typeof runNormalizeRawAssetJob>;
}

export class SourceSyncJobError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "SourceSyncJobError";
    this.cause = options?.cause;
  }

  declare cause?: unknown;
}

export class SourceSyncPostProcessingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "SourceSyncPostProcessingError";
    this.cause = options?.cause;
  }

  declare cause?: unknown;
}

export async function runRssSourceSyncJob(input: RunRssSourceSyncJobInput) {
  const source = await getRssSource(input.sourceId, input.databaseUrl);

  if (!source) {
    throw new SourceNotFoundError("Source not found.");
  }

  if (source.status === "paused") {
    throw new SourceSyncValidationError("Paused RSS sources cannot be synced.");
  }

  if (!source.sourceUrl) {
    throw new SourceSyncValidationError("RSS source URL is required for sync.");
  }

  console.info("source sync started", {
    job_type: "capture-sync",
    source_id: source.id,
    source_type: source.sourceType,
  });

  const execution = await beginSourceSyncExecution(
    {
      sourceId: source.id,
      triggerRef: input.triggerRef,
    },
    input.databaseUrl,
  );
  const normalizeRawAssetJobRunner = input.normalizeRawAssetJobRunner ?? runNormalizeRawAssetJob;

  try {
    const connectorResult = await fetchRssFeed({
      id: source.id,
      name: source.name,
      sourceUrl: source.sourceUrl,
    });
    const result = await completeRssSourceSyncExecution(
      {
        captureEntryId: execution.captureEntryId,
        connectorResult,
        sourceId: source.id,
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

        console.error("source sync post-capture processing failed", {
          capture_entry_id: result.captureEntryId,
          job_type: "capture-sync",
          message: causeMessage,
          raw_asset_id: rawAssetId,
          source_id: source.id,
          status: "failed",
        });

        throw new SourceSyncPostProcessingError(
          `Post-capture processing failed for source ${source.id} on raw asset ${rawAssetId}: ${causeMessage}`,
          {
            cause: error,
          },
        );
      }
    }

    console.info("source sync succeeded", {
      capture_entry_id: result.captureEntryId,
      job_type: "capture-sync",
      normalized_item_count: normalizedItemIds.length,
      persisted_count: result.persistedCount,
      processed_item_count: processedItemIds.length,
      raw_asset_count: result.rawAssetIds.length,
      source_id: source.id,
      status: "processed",
    });

    return {
      ...result,
      normalizedItemIds,
      processedItemIds,
    };
  } catch (error) {
    if (error instanceof SourceSyncPostProcessingError) {
      throw error;
    }

    const failure = await failSourceSyncExecution(
      {
        captureEntryId: execution.captureEntryId,
        error,
        sourceId: source.id,
      },
      input.databaseUrl,
    );

    console.error("source sync failed", {
      capture_entry_id: failure.captureEntryId,
      job_type: "capture-sync",
      message: failure.message,
      source_id: source.id,
      status: "failed",
    });

    throw new SourceSyncJobError(`RSS sync failed for source ${source.id}: ${failure.message}`, {
      cause: error,
    });
  }
}
