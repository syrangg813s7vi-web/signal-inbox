import { bootstrapInboxStorageSchema } from "@signal-inbox/db";
import { SubmittedUrlValidationError } from "@signal-inbox/capture";

import { isStorageUnavailableError, withSourceStorageReady } from "./sources";

class InboxStorageBootstrapActionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "InboxStorageBootstrapActionError";
  }
}

export async function ingestSubmittedUrl(submittedUrl: string) {
  return withSourceStorageReady(async () => {
    const { runSubmittedUrlIngestJob } = await import("@signal-inbox/core");

    if (process.env.VERCEL_ENV === "preview") {
      try {
        await bootstrapInboxStorageSchema();
      } catch (error) {
        throw new InboxStorageBootstrapActionError(getBootstrapActionMessage(error), {
          cause: error,
        });
      }
    }

    return runSubmittedUrlIngestJob({
      submittedUrl,
      triggerRef: "web:url-ingest",
    });
  });
}

export function getUrlIngestErrorMessage(error: unknown): string {
  if (error instanceof SubmittedUrlValidationError) {
    return error.message;
  }

  if (isStorageUnavailableError(error)) {
    return "Capture storage is unavailable in this environment.";
  }

  if (error instanceof InboxStorageBootstrapActionError) {
    return error.message;
  }

  if (isSubmittedUrlIngestError(error)) {
    return error.message;
  }

  return "The submitted URL could not be ingested.";
}

function isSubmittedUrlIngestError(
  error: unknown,
): error is {
  message: string;
  name: "SubmittedUrlIngestJobError" | "SubmittedUrlIngestPostProcessingError";
} {
  return (
    error instanceof Error &&
    (error.name === "SubmittedUrlIngestJobError" ||
      error.name === "SubmittedUrlIngestPostProcessingError")
  );
}

function getBootstrapActionMessage(error: unknown) {
  for (const candidate of walkErrorChain(error)) {
    const normalizedMessage = normalizeMessage(candidate.message);

    if (normalizedMessage === null) {
      continue;
    }

    if (normalizedMessage.includes('permission denied to create extension "pgcrypto"')) {
      return "Inbox storage bootstrap failed in this preview environment because the database role cannot install `pgcrypto`. Preinstall `pgcrypto` or expose `gen_random_uuid()` before trying the URL ingest endpoint again.";
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

  return "Inbox storage bootstrap failed in this preview environment. Run the database migrations for this environment or fix preview database permissions before trying the URL ingest endpoint again.";
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
