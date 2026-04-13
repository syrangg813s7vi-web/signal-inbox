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
  processItemJobRunner?: (input: {
    databaseUrl?: string;
    itemId: string;
  }) => ReturnType<typeof runProcessItemJob>;
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

  const processItemJobRunner = input.processItemJobRunner ?? runProcessItemJob;
  let result: Awaited<ReturnType<typeof normalizeRawAsset>>;

  try {
    result = await normalizeRawAsset(
      {
        rawAssetId: input.rawAssetId,
      },
      input.databaseUrl,
    );

    console.info("normalization succeeded", {
      capture_entry_id: result.captureEntryId,
      item_id: result.itemId,
      job_type: "normalize-item",
      raw_asset_id: result.rawAssetId,
      status: "normalized",
    });
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

  const processedResult = await processItemJobRunner(
    {
      databaseUrl: input.databaseUrl,
      itemId: result.itemId,
    },
  );

  return {
    ...result,
    processedItemId: processedResult.itemId,
  };
}
