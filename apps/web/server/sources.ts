import { listRssSources, type RssSourceRecord } from "@signal-inbox/capture";

export interface SourceStatusViewModel {
  badgeLabel: string;
  badgeTone: "active" | "muted" | "error";
  detail: string;
}

export interface SourcesPageViewModel {
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
  const sources = await listRssSources();

  return {
    sources: sources.map((source) => ({
      ...source,
      statusView: getStatusView(source),
    })),
  };
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
