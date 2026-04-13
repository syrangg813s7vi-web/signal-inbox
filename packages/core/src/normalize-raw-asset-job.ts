import {
  failRawAssetNormalization,
  getRawAssetNormalizationContext,
  normalizeRawAsset,
  NormalizationValidationError,
  RawAssetNotFoundError,
} from "@signal-inbox/normalization";

import { runProcessItemJob } from "./process-item-job";

export interface RunNormalizeRawAssetJobInput {
  databaseUrl?: string;
  rawAssetId: string;
}

export class NormalizeRawAssetJobError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "NormalizeRawAssetJobError";
    this.cause = options?.cause;
  }

  declare cause?: unknown;
}

export { NormalizationValidationError, RawAssetNotFoundError };

export async function runNormalizeRawAssetJob(input: RunNormalizeRawAssetJobInput) {
  console.info("normalization started", {
    job_type: "normalize-item",
    raw_asset_id: input.rawAssetId,
  });

  try {
    const result = await normalizeRawAsset(
      {
        rawAssetId: input.rawAssetId,
      },
      input.databaseUrl,
    );
    const processedResult = await runProcessItemJob(
      {
        databaseUrl: input.databaseUrl,
        itemId: result.itemId,
      },
    );

    console.info("normalization succeeded", {
      capture_entry_id: result.captureEntryId,
      item_id: result.itemId,
      job_type: "normalize-item",
      processed_item_id: processedResult.itemId,
      raw_asset_id: result.rawAssetId,
      status: "processed",
    });

    return {
      ...result,
      processedItemId: processedResult.itemId,
    };
  } catch (error) {
    const causeMessage =
      error instanceof Error && error.message ? error.message : "Normalization failed.";

    const rawAssetId = input.rawAssetId.trim();

    const context = await getRawAssetNormalizationContext(rawAssetId, input.databaseUrl);
    const failure = context
      ? await failRawAssetNormalization(
          {
            captureEntryId: context.captureEntryId,
            message: causeMessage,
            rawAssetId,
          },
          input.databaseUrl,
        )
      : null;

    if (error instanceof RawAssetNotFoundError || error instanceof NormalizationValidationError) {
      console.error("normalization failed", {
        capture_entry_id: failure?.captureEntryId ?? null,
        job_type: "normalize-item",
        message: causeMessage,
        raw_asset_id: rawAssetId,
        status: "failed",
      });

      throw error;
    }

    console.error("normalization failed", {
      capture_entry_id: failure?.captureEntryId ?? null,
      job_type: "normalize-item",
      message: causeMessage,
      raw_asset_id: rawAssetId,
      status: "failed",
    });

    throw new NormalizeRawAssetJobError(
      `Normalization failed for raw asset ${rawAssetId}: ${causeMessage}`,
      {
        cause: error,
      },
    );
  }
}
