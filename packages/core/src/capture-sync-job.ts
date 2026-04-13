import {
  beginSourceSyncExecution,
  completeRssSourceSyncExecution,
  failSourceSyncExecution,
  getRssSource,
  SourceNotFoundError,
  SourceSyncValidationError,
} from "@signal-inbox/capture";
import { fetchRssFeed } from "@signal-inbox/connectors";

export interface RunRssSourceSyncJobInput {
  sourceId: string;
  triggerRef?: string | null;
  databaseUrl?: string;
}

export class SourceSyncJobError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "SourceSyncJobError";
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

    console.info("source sync succeeded", {
      capture_entry_id: result.captureEntryId,
      job_type: "capture-sync",
      persisted_count: result.persistedCount,
      raw_asset_count: result.rawAssetIds.length,
      source_id: source.id,
      status: "captured",
    });

    return result;
  } catch (error) {
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
