import { listRssSources, type RssSourceRecord } from "@signal-inbox/capture";

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

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export async function getSourcesPageViewModel(): Promise<SourcesPageViewModel> {
  try {
    const sources = await listRssSources();

    return {
      isAvailable: true,
      unavailableReason: null,
      sources: sources.map((source) => ({
        ...source,
        statusView: getStatusView(source),
      })),
    };
  } catch (error) {
    if (isStorageUnavailableError(error)) {
      return {
        isAvailable: false,
        unavailableReason:
          "Source storage is unavailable in this environment. Configure the database to create, list, pause, or reactivate RSS sources.",
        sources: [],
      };
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

export function isStorageUnavailableError(error: unknown): boolean {
  for (const candidate of walkErrorChain(error)) {
    if (
      candidate.code === "ERR_INVALID_URL" ||
      candidate.code === "42P01" ||
      candidate.code === "3F000" ||
      candidate.code === "42704"
    ) {
      return true;
    }

    if (typeof candidate.message !== "string") {
      continue;
    }

    const message = candidate.message.toLowerCase();

    if (message.includes("database_url must be set")) {
      return true;
    }

    if (
      message.includes("invalid url") ||
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
      message.includes("relation \"sources\" does not exist") ||
      message.includes("relation \"source_sync_state\" does not exist") ||
      message.includes("type \"source_type\" does not exist") ||
      message.includes("type \"source_status\" does not exist")
    ) {
      return true;
    }
  }

  return false;
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
