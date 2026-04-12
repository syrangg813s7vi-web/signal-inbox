import { listRssSources, type RssSourceRecord } from "@signal-inbox/capture";
import { runMigrations } from "@signal-inbox/db";

export interface SourceStatusViewModel {
  badgeLabel: string;
  badgeTone: "active" | "muted" | "error";
  detail: string;
}

export interface SourcesPageViewModel {
  isAvailable: boolean;
  unavailableReason: string | null;
  sources: Array<
    RssSourceRecord & {
      statusView: SourceStatusViewModel;
    }
  >;
}

type StorageUnavailableKind =
  | "bootstrap"
  | "configuration"
  | "connection"
  | "schema"
  | "unknown";

class SourceStorageBootstrapError extends Error {
  constructor(cause: unknown) {
    super("Source storage bootstrap failed.", { cause });
  }
}

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

let sourceStorageBootstrapPromise: Promise<void> | null = null;

export async function getSourcesPageViewModel(): Promise<SourcesPageViewModel> {
  try {
    const sources = await withSourceStorageReady(() => listRssSources());

    return {
      isAvailable: true,
      unavailableReason: null,
      sources: sources.map((source) => ({
        ...source,
        statusView: getStatusView(source),
      })),
    };
  } catch (error) {
    const storageUnavailableKind = getStorageUnavailableKind(error);

    if (storageUnavailableKind !== null) {
      return {
        isAvailable: false,
        unavailableReason: getUnavailableReason(storageUnavailableKind),
        sources: [],
      };
    }

    throw error;
  }
}

export async function withSourceStorageReady<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (getStorageUnavailableKind(error) === "schema" && shouldAttemptPreviewSchemaBootstrap()) {
      try {
        await ensureSourceStorageSchema();
      } catch (bootstrapError) {
        throw new SourceStorageBootstrapError(bootstrapError);
      }

      return operation();
    }

    throw error;
  }
}

function getStatusView(source: RssSourceRecord): SourceStatusViewModel {
  const syncState = source.syncState;

  if (!syncState) {
    return {
      badgeLabel: labelForStatus(source.status),
      badgeTone: toneForStatus(source.status),
      detail: "Sync state has not been initialized yet.",
    };
  }

  if (source.status === "paused") {
    return {
      badgeLabel: "Paused",
      badgeTone: "muted",
      detail:
        syncState.lastSuccessAt !== null
          ? `Paused. Last successful sync ${formatTimestamp(syncState.lastSuccessAt)}.`
          : "Paused before the first sync.",
    };
  }

  if (source.status === "error") {
    return {
      badgeLabel: "Error",
      badgeTone: "error",
      detail:
        syncState.lastErrorAt !== null
          ? `Last sync error ${formatTimestamp(syncState.lastErrorAt)}${syncState.lastErrorMessage ? `: ${syncState.lastErrorMessage}` : "."}`
          : "An error state is recorded for this source.",
    };
  }

  if (syncState.lastSuccessAt !== null) {
    return {
      badgeLabel: "Active",
      badgeTone: "active",
      detail: `Last successful sync ${formatTimestamp(syncState.lastSuccessAt)}.`,
    };
  }

  if (syncState.lastSyncedAt !== null) {
    return {
      badgeLabel: "Active",
      badgeTone: "active",
      detail: `Last sync attempt ${formatTimestamp(syncState.lastSyncedAt)}.`,
    };
  }

  return {
    badgeLabel: "Active",
    badgeTone: "active",
    detail: "Awaiting first sync.",
  };
}

function labelForStatus(status: RssSourceRecord["status"]): string {
  if (status === "active") {
    return "Active";
  }

  if (status === "paused") {
    return "Paused";
  }

  return "Error";
}

function toneForStatus(status: RssSourceRecord["status"]): SourceStatusViewModel["badgeTone"] {
  if (status === "active") {
    return "active";
  }

  if (status === "paused") {
    return "muted";
  }

  return "error";
}

function formatTimestamp(value: Date): string {
  return timestampFormatter.format(value);
}

function shouldAttemptPreviewSchemaBootstrap(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

async function ensureSourceStorageSchema() {
  if (!sourceStorageBootstrapPromise) {
    sourceStorageBootstrapPromise = runMigrations().finally(() => {
      sourceStorageBootstrapPromise = null;
    });
  }

  await sourceStorageBootstrapPromise;
}

export function isStorageUnavailableError(error: unknown): boolean {
  return getStorageUnavailableKind(error) !== null;
}

function getStorageUnavailableKind(error: unknown): StorageUnavailableKind | null {
  for (const candidate of walkErrorChain(error)) {
    if (candidate.code === "42501") {
      return "bootstrap";
    }

    if (
      candidate.code === "42P01" ||
      candidate.code === "3F000" ||
      candidate.code === "42704"
    ) {
      return "schema";
    }

    if (candidate.code === "ERR_INVALID_URL") {
      return "configuration";
    }

    if (typeof candidate.message !== "string") {
      continue;
    }

    const message = candidate.message.toLowerCase();

    if (message.includes("source storage bootstrap failed")) {
      return "bootstrap";
    }

    if (message.includes("database_url must be set")) {
      return "configuration";
    }

    if (message.includes("invalid url")) {
      return "configuration";
    }

    if (
      message.includes("relation \"sources\" does not exist") ||
      message.includes("relation \"source_sync_state\" does not exist") ||
      message.includes("type \"source_type\" does not exist") ||
      message.includes("type \"source_status\" does not exist")
    ) {
      return "schema";
    }

    if (
      message.includes("connect") ||
      message.includes("connection terminated") ||
      message.includes("connection refused") ||
      message.includes("timed out") ||
      message.includes("timeout") ||
      message.includes("enotfound") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("certificate") ||
      message.includes("tls") ||
      message.includes("server closed the connection unexpectedly") ||
      message.includes("password authentication failed") ||
      message.includes("no pg_hba.conf entry") ||
      message.includes("permission denied") ||
      message.includes("must be owner of")
    ) {
      return message.includes("permission denied") || message.includes("must be owner of")
        ? "bootstrap"
        : "connection";
    }
  }

  return null;
}

function getUnavailableReason(kind: StorageUnavailableKind): string {
  if (kind === "bootstrap") {
    return "Source storage is configured, but automatic preview migration bootstrap failed. Run the database migrations for this environment or grant the preview database user permission to create the required schema objects.";
  }

  if (kind === "configuration") {
    return "Source storage is unavailable because this environment is missing a valid DATABASE_URL.";
  }

  if (kind === "schema") {
    return "Source storage is configured, but the source tables or enums are missing. Run the database migrations for this environment.";
  }

  if (kind === "connection") {
    return "Source storage is configured, but the database connection failed in this environment.";
  }

  return "Source storage is unavailable in this environment. Configure the database to create, list, pause, or reactivate RSS sources.";
}

function* walkErrorChain(error: unknown): Generator<{ code?: string; message?: string }> {
  let current = error;
  const seen = new Set<unknown>();

  while (current && !seen.has(current)) {
    seen.add(current);

    if (typeof current === "object" && current !== null) {
      const candidate = current as {
        cause?: unknown;
        code?: string;
        message?: string;
      };

      yield {
        code: candidate.code,
        message: candidate.message,
      };

      current = candidate.cause;
      continue;
    }

    if (typeof current === "string") {
      yield { message: current };
      return;
    }

    return;
  }
}
