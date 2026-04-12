import {
  createRssSource,
  pauseSource,
  reactivateSource,
  SourceConflictError,
  SourceNotFoundError,
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

export async function pauseSourceFromFormData(formData: FormData) {
  const sourceId = String(formData.get("sourceId") ?? "");
  return withSourceStorageReady(() => pauseSource(sourceId));
}

export async function reactivateSourceFromFormData(formData: FormData) {
  const sourceId = String(formData.get("sourceId") ?? "");
  return withSourceStorageReady(() => reactivateSource(sourceId));
}

export function getMutationErrorMessage(error: unknown): string {
  if (
    error instanceof SourceValidationError ||
    error instanceof SourceConflictError ||
    error instanceof SourceNotFoundError
  ) {
    return error.message;
  }

  if (isStorageUnavailableError(error)) {
    return "Source storage is unavailable in this environment.";
  }

  return "The source update could not be completed.";
}
