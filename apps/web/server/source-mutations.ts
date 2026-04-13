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

class InboxStorageBootstrapActionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "InboxStorageBootstrapActionError";
  }
}

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
      try {
        await bootstrapInboxStorageSchema();
      } catch (error) {
        throw new InboxStorageBootstrapActionError(
          getInboxStorageBootstrapActionMessage(error),
          { cause: error },
        );
      }
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

  if (error instanceof InboxStorageBootstrapActionError) {
    return error.message;
  }

  if (error instanceof SourceSyncPostProcessingError || error instanceof SourceSyncJobError) {
    return error.message;
  }

  return "The source update could not be completed.";
}

function getInboxStorageBootstrapActionMessage(error: unknown) {
  for (const candidate of walkErrorChain(error)) {
    const normalizedMessage = normalizeMessage(candidate.message);

    if (normalizedMessage === null) {
      continue;
    }

    if (normalizedMessage.includes('permission denied to create extension "pgcrypto"')) {
      return "Inbox storage bootstrap failed in this preview environment because the database role cannot install `pgcrypto`. Preinstall `pgcrypto` or expose `gen_random_uuid()` before running `Sync now` again.";
    }

    if (
      normalizedMessage.includes("permission denied for database") ||
      normalizedMessage.includes("permission denied for schema") ||
      normalizedMessage.includes("must be owner of")
    ) {
      return appendSupplementalErrorText(
        "Inbox storage bootstrap failed in this preview environment because the database role does not have enough DDL permission. Grant the preview role create privileges or run the migrations ahead of time.",
        candidate,
      );
    }

    if (normalizedMessage.includes("database_url must be set")) {
      return "Inbox storage bootstrap failed because this environment is missing `DATABASE_URL`.";
    }
  }

  return "Inbox storage bootstrap failed in this preview environment. Run the database migrations for this environment or fix preview database permissions before using `Sync now`.";
}

function appendSupplementalErrorText(
  message: string,
  candidate: {
    detail?: string;
    hint?: string;
  },
) {
  const fragments = [candidate.detail, candidate.hint]
    .map((value) => normalizeMessage(value))
    .filter((value): value is string => value !== null);

  if (fragments.length === 0) {
    return message;
  }

  return `${message} ${fragments.join(" ")}`;
}

function normalizeMessage(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function* walkErrorChain(error: unknown): Generator<{
  detail?: string;
  hint?: string;
  message?: string;
}> {
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || seen.has(current)) {
      continue;
    }

    seen.add(current);

    if (typeof current === "object") {
      const candidate = current as {
        cause?: unknown;
        detail?: string;
        error?: unknown;
        errors?: unknown[];
        hint?: string;
        message?: string;
        originalError?: unknown;
      };

      yield {
        detail: candidate.detail,
        hint: candidate.hint,
        message: candidate.message,
      };

      if (candidate.cause) {
        queue.push(candidate.cause);
      }

      if (candidate.originalError) {
        queue.push(candidate.originalError);
      }

      if (candidate.error) {
        queue.push(candidate.error);
      }

      if (Array.isArray(candidate.errors)) {
        queue.push(...candidate.errors);
      }
    }
  }
}
