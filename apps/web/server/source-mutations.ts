import {
  createRssSource,
  pauseSource,
  reactivateSource,
  SourceConflictError,
  SourceNotFoundError,
  SourceValidationError,
} from "@signal-inbox/capture";
import { isStorageUnavailableError } from "./sources";

export async function createRssSourceFromFormData(formData: FormData) {
  return createRssSource({
    name: String(formData.get("name") ?? ""),
    sourceUrl: String(formData.get("sourceUrl") ?? ""),
    topic: String(formData.get("topic") ?? ""),
  });
}

export async function pauseSourceFromFormData(formData: FormData) {
  const sourceId = String(formData.get("sourceId") ?? "");
  return pauseSource(sourceId);
}

export async function reactivateSourceFromFormData(formData: FormData) {
  const sourceId = String(formData.get("sourceId") ?? "");
  return reactivateSource(sourceId);
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
