import { bootstrapInboxStorageSchema, createSqlClient } from "@signal-inbox/db";
import { listSelectedInboxItems } from "@signal-inbox/review";

export interface InboxItemViewModel {
  classification: string | null;
  duplicateOfItemId: string | null;
  id: string;
  importanceScore: number | null;
  itemType: "article" | "video";
  itemTypeLabel: string;
  metaLine: string | null;
  noveltyScore: number | null;
  publishedAtLabel: string | null;
  selection: {
    metadata: Record<string, unknown>;
    policyVersion: string;
    reasons: string[];
    relevanceScore: number;
    scoreBreakdown: {
      importanceScore: number;
      noveltyScore: number;
      qualityAdjustment: number;
      totalScore: number;
    };
  };
  sourceName: string | null;
  sourceTopic: string | null;
  sourceTypeLabel: string | null;
  summaryShort: string | null;
  tags: string[];
  title: string;
  topic: string | null;
  topicGroupTitle: string | null;
  url: string | null;
  video: {
    creatorName: string | null;
    durationLabel: string | null;
    platformLabel: string | null;
    targetUrl: string | null;
    thumbnailUrl: string | null;
  } | null;
}

export interface InboxPageViewModel {
  isAvailable: boolean;
  items: InboxItemViewModel[];
  unavailableReason: string | null;
}

type SelectedInboxRow = Awaited<ReturnType<typeof listSelectedInboxItems>>[number];
type InboxUnavailableKind = "bootstrap" | "configuration" | "connection" | "schema";

class InboxStorageBootstrapError extends Error {
  constructor(cause: unknown) {
    super("Inbox storage bootstrap failed.", { cause });
    this.name = "InboxStorageBootstrapError";
  }
}

interface PreviewInboxProbeResult {
  captureEntriesExists: boolean;
  enrichmentsExists: boolean;
  inboxSelectionsExists: boolean;
  itemGroupMembersExists: boolean;
  itemGroupsExists: boolean;
  itemsExists: boolean;
  publicCreate: boolean;
  publicUsage: boolean;
  rawAssetsExists: boolean;
}

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

let inboxStorageBootstrapPromise: Promise<void> | null = null;

export async function getInboxPageViewModel(): Promise<InboxPageViewModel> {
  try {
    const rows = await withInboxStorageReady(() => listSelectedInboxItems());

    return {
      isAvailable: true,
      items: rows.map(mapInboxRow),
      unavailableReason: null,
    };
  } catch (error) {
    const unavailableKind = getInboxUnavailableKind(error);

    if (unavailableKind !== null) {
      return {
        isAvailable: false,
        items: [],
        unavailableReason: await getUnavailableReason(unavailableKind, error),
      };
    }

    console.error("inbox view model failed", {
      message: error instanceof Error ? error.message : "Unknown inbox failure.",
    });

    return {
      isAvailable: false,
      items: [],
      unavailableReason: await getUnexpectedUnavailableReason(error),
    };
  }
}

async function withInboxStorageReady<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (getInboxUnavailableKind(error) === "schema" && shouldAttemptPreviewSchemaBootstrap()) {
      try {
        await ensureInboxStorageSchema();
      } catch (bootstrapError) {
        throw new InboxStorageBootstrapError(bootstrapError);
      }

      return operation();
    }

    throw error;
  }
}

function mapInboxRow(row: SelectedInboxRow): InboxItemViewModel {
  const video = parseVideoViewModel(row.metadata);
  const summaryShort = resolveInboxSummaryShort(row, video);

  return {
    classification: row.classification,
    duplicateOfItemId: row.duplicateOfItemId,
    id: row.id,
    importanceScore: row.importanceScore,
    itemType: row.itemType,
    itemTypeLabel: row.itemType === "video" ? "Video" : "Article",
    metaLine: buildMetaLine({
      itemType: row.itemType,
      publishedAt: row.publishedAt,
      sourceType: row.sourceType,
      video,
    }),
    noveltyScore: row.noveltyScore,
    publishedAtLabel: row.publishedAt ? timestampFormatter.format(row.publishedAt) : null,
    selection: {
      metadata: row.selectionMetadata,
      policyVersion: row.selectionPolicyVersion,
      reasons: row.selectionReasons,
      relevanceScore: row.selectionScore,
      scoreBreakdown: row.scoreBreakdown,
    },
    sourceName: row.sourceName?.trim() || null,
    sourceTopic: row.sourceTopic?.trim() || null,
    sourceTypeLabel: row.sourceType ? formatSourceTypeLabel(row.sourceType) : null,
    summaryShort,
    tags: row.tags ?? [],
    title: row.title?.trim() || "Untitled item",
    topic: row.topic,
    topicGroupTitle: row.topicGroupTitle,
    url: video?.targetUrl ?? row.canonicalUrl,
    video,
  };
}

function formatSourceTypeLabel(sourceType: "rss") {
  return sourceType === "rss" ? "RSS" : sourceType;
}

function resolveInboxSummaryShort(
  row: Pick<SelectedInboxRow, "contentText" | "summaryLong" | "summaryShort" | "title">,
  video: InboxItemViewModel["video"],
) {
  const title = normalizeWhitespace(row.title ?? "");
  const persistedSummaryShort = normalizeWhitespace(row.summaryShort ?? "");

  if (isStandaloneSummaryShort({ summaryShort: persistedSummaryShort, title })) {
    return persistedSummaryShort;
  }

  const derivedSummary = deriveLegacySummaryShort({
    contentText: row.contentText,
    summaryLong: row.summaryLong,
    title,
  });

  if (derivedSummary) {
    return derivedSummary;
  }

  return buildVideoSummaryFallback(video);
}

function deriveLegacySummaryShort(input: {
  contentText: string | null;
  summaryLong: string | null;
  title: string;
}) {
  const candidates = [input.summaryLong, input.contentText]
    .flatMap((value) => splitSummaryCandidates(value))
    .filter((candidate, index, values) => values.indexOf(candidate) === index);

  const firstStandaloneCandidate = candidates.find((candidate) =>
    isStandaloneSummaryShort({
      summaryShort: candidate,
      title: input.title,
    }),
  );

  return firstStandaloneCandidate ? truncateSummaryShort(firstStandaloneCandidate) : null;
}

function splitSummaryCandidates(value: string | null) {
  const normalized = normalizeWhitespace(value ?? "");

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((candidate) => normalizeWhitespace(candidate))
    .filter((candidate) => candidate.length >= 12)
    .filter((candidate) => !isGreetingLikeCandidate(candidate))
    .filter((candidate) => !isPromoLikeCandidate(candidate));
}

function isStandaloneSummaryShort(input: { summaryShort: string; title: string }) {
  if (!input.summaryShort) {
    return false;
  }

  if (!input.title) {
    return true;
  }

  if (input.summaryShort.localeCompare(input.title, undefined, { sensitivity: "accent" }) === 0) {
    return false;
  }

  const repeatedTitlePattern = new RegExp(`^${escapeRegExp(input.title)}\\s*[:\\-\\u2013\\u2014]\\s+`, "i");

  return !repeatedTitlePattern.test(input.summaryShort);
}

function isGreetingLikeCandidate(candidate: string) {
  return /^(hi|hello|hey|good (morning|afternoon|evening)|dear)\b/i.test(candidate);
}

function isPromoLikeCandidate(candidate: string) {
  return /^listen to this update\b/i.test(candidate);
}

function truncateSummaryShort(value: string) {
  const maxLength = 180;

  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength + 1);
  const lastSpaceIndex = truncated.lastIndexOf(" ");

  if (lastSpaceIndex < 80) {
    return `${value.slice(0, maxLength).trimEnd()}…`;
  }

  return `${truncated.slice(0, lastSpaceIndex).trimEnd()}…`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseVideoViewModel(metadata: Record<string, unknown>) {
  const video = asRecord(metadata.video);

  if (!video) {
    return null;
  }

  const durationLabel = firstNonEmpty([
    readString(video.durationLabel),
    formatDurationLabel(readNumber(video.durationSeconds)),
  ]);
  const platform = readString(video.platform);

  return {
    creatorName: readString(video.creatorName),
    durationLabel,
    platformLabel: platform ? formatVideoPlatformLabel(platform) : "Video",
    targetUrl: readString(video.targetUrl),
    thumbnailUrl: readString(video.thumbnailUrl),
  };
}

function buildMetaLine(input: {
  itemType: InboxItemViewModel["itemType"];
  publishedAt: Date | null;
  sourceType: "rss" | null;
  video: InboxItemViewModel["video"];
}) {
  if (input.itemType === "video") {
    const parts = [
      "Video",
      input.video?.platformLabel ?? null,
      input.video?.creatorName ?? null,
      input.video?.durationLabel ?? null,
    ].filter((value): value is string => Boolean(value));

    return parts.length > 0 ? parts.join(" · ") : "Video";
  }

  const parts = [
    input.sourceType ? formatSourceTypeLabel(input.sourceType) : null,
    input.publishedAt ? timestampFormatter.format(input.publishedAt) : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" · ") : null;
}

function buildVideoSummaryFallback(video: InboxItemViewModel["video"]) {
  if (!video) {
    return null;
  }

  const parts = [
    video.platformLabel ? `Video from ${video.platformLabel}` : "Video item",
    video.creatorName ? `by ${video.creatorName}` : null,
    video.durationLabel ? `(${video.durationLabel})` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.join(" ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstNonEmpty(values: Array<string | null>) {
  return values.find((value) => Boolean(value)) ?? null;
}

function formatVideoPlatformLabel(platform: string) {
  switch (platform.toLowerCase()) {
    case "youtube":
      return "YouTube";
    case "vimeo":
      return "Vimeo";
    case "direct":
      return "Direct video";
    default:
      return "Video";
  }
}

function formatDurationLabel(durationSeconds: number | null) {
  if (durationSeconds === null) {
    return null;
  }

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getInboxUnavailableKind(error: unknown): InboxUnavailableKind | null {
  for (const candidate of walkErrorChain(error)) {
    if (candidate.code === "42501") {
      return "bootstrap";
    }

    if (candidate.code === "ERR_INVALID_URL") {
      return "configuration";
    }

    if (candidate.code === "42P01" || candidate.code === "3F000" || candidate.code === "42704") {
      return "schema";
    }

    if (
      candidate.code === "ECONNREFUSED" ||
      candidate.code === "ENOTFOUND" ||
      candidate.code === "ETIMEDOUT"
    ) {
      return "connection";
    }

    if (typeof candidate.message !== "string") {
      continue;
    }

    const message = candidate.message.toLowerCase();

    if (message.includes("inbox storage bootstrap failed")) {
      return "bootstrap";
    }

    if (message.includes("database_url must be set")) {
      return "configuration";
    }

    if (
      message.includes('relation "items" does not exist') ||
      message.includes('relation "enrichments" does not exist') ||
      message.includes('relation "inbox_selections" does not exist') ||
      message.includes('relation "item_group_members" does not exist') ||
      message.includes('relation "item_groups" does not exist') ||
      message.includes('relation "capture_entries" does not exist') ||
      message.includes('relation "raw_assets" does not exist') ||
      message.includes('type "capture_entry_status" does not exist') ||
      message.includes('type "capture_entry_type" does not exist') ||
      message.includes('type "item_group_type" does not exist') ||
      message.includes('type "item_status" does not exist') ||
      message.includes('type "item_type" does not exist') ||
      message.includes('type "raw_asset_status" does not exist') ||
      message.includes('type "raw_asset_type" does not exist')
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

async function getUnavailableReason(kind: InboxUnavailableKind, error?: unknown) {
  if (kind === "bootstrap") {
    const detail = await getBootstrapFailureDetail(error);

    return detail
      ? `Inbox storage is configured, but automatic preview migration bootstrap failed. ${detail}`
      : "Inbox storage is configured, but automatic preview migration bootstrap failed. Run the database migrations for this environment or grant the preview database user permission to create the required schema objects.";
  }

  if (kind === "configuration") {
    return "Inbox data is unavailable because the database is not configured for this environment.";
  }

  if (kind === "schema") {
    return "Inbox data is unavailable because the current database schema is not ready yet.";
  }

  if (kind === "connection") {
    return "Inbox data is unavailable because the database connection could not be established.";
  }

  return "Inbox data is unavailable in this environment.";
}

function shouldAttemptPreviewSchemaBootstrap() {
  return process.env.VERCEL_ENV === "preview";
}

async function ensureInboxStorageSchema() {
  if (!inboxStorageBootstrapPromise) {
    inboxStorageBootstrapPromise = bootstrapInboxStorageSchema().finally(() => {
      inboxStorageBootstrapPromise = null;
    });
  }

  await inboxStorageBootstrapPromise;
}

async function loadPreviewInboxProbeResult(): Promise<PreviewInboxProbeResult | null> {
  if (!shouldAttemptPreviewSchemaBootstrap()) {
    return null;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return null;
  }

  const client = createSqlClient(databaseUrl);

  try {
    const [probe] = await client<PreviewInboxProbeResult[]>`
      select
        has_schema_privilege('public', 'CREATE') as "publicCreate",
        has_schema_privilege('public', 'USAGE') as "publicUsage",
        to_regclass('public.capture_entries') is not null as "captureEntriesExists",
        to_regclass('public.raw_assets') is not null as "rawAssetsExists",
        to_regclass('public.items') is not null as "itemsExists",
        to_regclass('public.enrichments') is not null as "enrichmentsExists",
        to_regclass('public.item_groups') is not null as "itemGroupsExists",
        to_regclass('public.item_group_members') is not null as "itemGroupMembersExists",
        to_regclass('public.inbox_selections') is not null as "inboxSelectionsExists"
    `;

    return probe ?? null;
  } catch {
    return null;
  } finally {
    await client.end();
  }
}

async function getBootstrapFailureDetail(error: unknown): Promise<string | null> {
  for (const candidate of walkErrorChain(error)) {
    if (candidate.code === "42501") {
      return appendPreviewProbeDetail(
        appendBootstrapHints(
          "The preview database role does not have enough DDL permission to create the required schema objects. Grant the preview role create privileges or run the migrations ahead of time.",
          candidate,
        ),
        await loadPreviewInboxProbeResult(),
      );
    }

    if (!candidate.message) {
      continue;
    }

    const message = candidate.message.toLowerCase();

    if (
      message.includes("inbox storage bootstrap failed") ||
      message.includes("permission denied") ||
      message.includes("must be owner of")
    ) {
      return appendPreviewProbeDetail(
        appendBootstrapHints(candidate.message, candidate),
        await loadPreviewInboxProbeResult(),
      );
    }
  }

  return null;
}

function formatPrivilege(value: boolean): string {
  return value ? "yes" : "no";
}

function formatPresence(value: boolean): string {
  return value ? "present" : "missing";
}

function appendBootstrapHints(
  message: string,
  candidate: {
    detail?: string;
    hint?: string;
  },
) {
  const parts = [message];

  if (candidate.detail) {
    parts.push(`Detail: ${candidate.detail}`);
  }

  if (candidate.hint) {
    parts.push(`Hint: ${candidate.hint}`);
  }

  return parts.join(" ");
}

function appendPreviewProbeDetail(message: string, probe: PreviewInboxProbeResult | null) {
  if (!probe) {
    return message;
  }

  return `${message} Preview probe: public CREATE=${formatPrivilege(probe.publicCreate)}, public USAGE=${formatPrivilege(probe.publicUsage)}, capture_entries=${formatPresence(probe.captureEntriesExists)}, raw_assets=${formatPresence(probe.rawAssetsExists)}, items=${formatPresence(probe.itemsExists)}, enrichments=${formatPresence(probe.enrichmentsExists)}, item_groups=${formatPresence(probe.itemGroupsExists)}, item_group_members=${formatPresence(probe.itemGroupMembersExists)}, inbox_selections=${formatPresence(probe.inboxSelectionsExists)}.`;
}

async function getUnexpectedUnavailableReason(error: unknown) {
  if (process.env.VERCEL_ENV === "preview") {
    const probe = await loadPreviewInboxProbeResult();

    if (probe) {
      return `Inbox data is temporarily unavailable in this preview environment. Preview probe: public CREATE=${formatPrivilege(probe.publicCreate)}, public USAGE=${formatPrivilege(probe.publicUsage)}, capture_entries=${formatPresence(probe.captureEntriesExists)}, raw_assets=${formatPresence(probe.rawAssetsExists)}, items=${formatPresence(probe.itemsExists)}, enrichments=${formatPresence(probe.enrichmentsExists)}, item_groups=${formatPresence(probe.itemGroupsExists)}, item_group_members=${formatPresence(probe.itemGroupMembersExists)}, inbox_selections=${formatPresence(probe.inboxSelectionsExists)}.`;
    }

    return "Inbox data is temporarily unavailable in this preview environment.";
  }

  if (error instanceof Error && error.message) {
    return `Inbox data is unavailable: ${error.message}`;
  }

  return "Inbox data is unavailable because an unexpected server error occurred.";
}

function* walkErrorChain(error: unknown): Generator<{
  code?: string;
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
        code?: string;
        detail?: string;
        error?: unknown;
        errors?: unknown[];
        hint?: string;
        message?: string;
        originalError?: unknown;
      };

      yield {
        code: candidate.code,
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
