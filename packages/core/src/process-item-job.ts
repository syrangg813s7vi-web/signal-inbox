import {
  processItem,
  recordItemProcessingFailure,
  ItemNotFoundError,
  ItemProcessingValidationError,
} from "@signal-inbox/knowledge";

export interface RunProcessItemJobInput {
  databaseUrl?: string;
  itemId: string;
}

export class ProcessItemJobError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ProcessItemJobError";
    this.cause = options?.cause;
  }

  declare cause?: unknown;
}

export { ItemNotFoundError, ItemProcessingValidationError };

export async function runProcessItemJob(input: RunProcessItemJobInput) {
  console.info("knowledge processing started", {
    item_id: input.itemId,
    job_type: "process-item",
  });

  try {
    const result = await processItem(
      {
        itemId: input.itemId,
      },
      input.databaseUrl,
    );

    console.info("knowledge processing succeeded", {
      classification: result.classification,
      duplicate_of_item_id: result.duplicateOfItemId,
      enrichment_id: result.enrichmentId,
      group_id: result.groupId,
      item_id: result.itemId,
      job_type: "process-item",
      status: result.status,
      topic: result.topic,
    });

    return result;
  } catch (error) {
    const causeMessage =
      error instanceof Error && error.message ? error.message : "Knowledge processing failed.";
    const itemId = input.itemId.trim();

    const failure = await recordItemProcessingFailure(
      {
        itemId,
        message: causeMessage,
      },
      input.databaseUrl,
    );

    console.error("knowledge processing failed", {
      failed_at: failure?.failedAt ?? null,
      item_id: itemId,
      job_type: "process-item",
      message: causeMessage,
      status: "failed",
    });

    if (error instanceof ItemNotFoundError || error instanceof ItemProcessingValidationError) {
      throw error;
    }

    throw new ProcessItemJobError(`Knowledge processing failed for item ${itemId}: ${causeMessage}`, {
      cause: error,
    });
  }
}
