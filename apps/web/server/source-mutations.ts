import { bootstrapInboxStorageSchema } from "@signal-inbox/db";
import {
  runRssSourceSyncJob,
  SourceSyncJobError,
  SourceSyncPostProcessingError,
} from "@signal-inbox/core";
import {
  createRssSource,
  deleteSource,
  pauseSource,
  reactivateSource,
  SourceConflictError,
  SourceNotFoundError,
  SourceSyncValidationError,
  SourceValidationError,
} from "@signal-inbox/capture";
import { isStorageUnavailableError, withSourceStorageReady } from "./sources";

export async function createRssSourceFromFormData(formData: FormData) {
  return withSourceStorageReady(() =>
    createRssSource({
      name: String(formData.get("name") ?? ""),
      sourceUrl: String(formData.get("sourceUrl") ?? ""),
      topic: String(formData.get("topic") ?? ""),
    }),
  );
}

export async function pauseSourceById(sourceId: string) {
  return withSourceStorageReady(() => pauseSource(sourceId));
}

export async function reactivateSourceById(sourceId: string) {
  return withSourceStorageReady(() => reactivateSource(sourceId));
}

export async function deleteSourceById(sourceId: string) {
  return withSourceStorageReady(() => deleteSource(sourceId));
}

export async function syncSourceById(sourceId: string) {
  return withSourceStorageReady(async () => {
    if (process.env.VERCEL_ENV === "preview") {
      await bootstrapInboxStorageSchema();
    }

    return runRssSourceSyncJob({
      sourceId,
      triggerRef: `web-manual-sync:${sourceId}`,
    });
  });
}

export function getMutationErrorMessage(error: unknown): string {
  if (
    error instanceof SourceValidationError ||
    error instanceof SourceConflictError ||
    error instanceof SourceNotFoundError ||
    error instanceof SourceSyncValidationError
  ) {
    return error.message;
  }

  if (isStorageUnavailableError(error)) {
    return "Source storage is unavailable in this environment.";
  }

  if (error instanceof SourceSyncPostProcessingError || error instanceof SourceSyncJobError) {
    return error.message;
  }

  return "The source update could not be completed.";
}
