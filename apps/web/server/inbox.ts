import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import {
  bootstrapInboxStorageSchema,
  captureEntries,
  createDbFromClient,
  createSqlClient,
  enrichments,
  itemGroupMembers,
  itemGroups,
  items,
  rawAssets,
  sources,
} from "@signal-inbox/db";

export interface InboxItemViewModel {
  classification: string | null;
  duplicateOfItemId: string | null;
  id: string;
  importanceScore: number | null;
  noveltyScore: number | null;
  publishedAtLabel: string | null;
  sourceName: string | null;
  sourceTopic: string | null;
  sourceTypeLabel: string | null;
  summaryShort: string | null;
  tags: string[];
  title: string;
  topic: string | null;
  topicGroupTitle: string | null;
  url: string | null;
}

export interface InboxPageViewModel {
  isAvailable: boolean;
  items: InboxItemViewModel[];
  unavailableReason: string | null;
}

interface InboxRow {
  canonicalUrl: string | null;
  classification: string | null;
  contentText: string | null;
  id: string;
  importanceScore: number | null;
  metadata: Record<string, unknown>;
  noveltyScore: number | null;
  publishedAt: Date | null;
  sourceName: string | null;
  sourceTopic: string | null;
  sourceType: "rss" | null;
  summaryLong: string | null;
  summaryShort: string | null;
  tags: string[] | null;
  title: string | null;
  topic: string | null;
  topicGroupTitle: string | null;
}

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
const MAX_COMPACT_SUMMARY_LENGTH = 220;

let inboxStorageBootstrapPromise: Promise<void> | null = null;

export async function getInboxPageViewModel(): Promise<InboxPageViewModel> {
  try {
    const rows = await withInboxStorageReady(() => loadInboxRows());

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

async function loadInboxRows() {
  const client = createSqlClient();
  const db = createDbFromClient(client);
  const topicGroupTitles = db
    .select({
      itemId: itemGroupMembers.itemId,
      topicGroupTitle: sql<string | null>`
        case
          when count(*) = 1 then min(${itemGroups.title})
          else null
        end
      `.as("topicGroupTitle"),
    })
    .from(itemGroupMembers)
    .innerJoin(
      itemGroups,
      and(eq(itemGroups.id, itemGroupMembers.groupId), eq(itemGroups.groupType, "topic")),
    )
    .groupBy(itemGroupMembers.itemId)
    .as("topic_group_titles");

  try {
    return await db
      .select({
        canonicalUrl: items.canonicalUrl,
        classification: enrichments.classification,
        contentText: items.contentText,
        id: items.id,
        importanceScore: enrichments.importanceScore,
        metadata: items.metadata,
        noveltyScore: enrichments.noveltyScore,
        publishedAt: items.publishedAt,
        sourceName: sources.name,
        sourceTopic: sources.topic,
        sourceType: sources.sourceType,
        summaryLong: enrichments.summaryLong,
        summaryShort: enrichments.summaryShort,
        tags: enrichments.tags,
        title: items.title,
        topic: enrichments.topic,
        topicGroupTitle: topicGroupTitles.topicGroupTitle,
      })
      .from(items)
      .innerJoin(
        enrichments,
        and(eq(enrichments.itemId, items.id), eq(enrichments.isCurrent, true)),
      )
      .leftJoin(rawAssets, eq(rawAssets.id, items.rawAssetId))
      .leftJoin(captureEntries, eq(captureEntries.id, rawAssets.captureEntryId))
      .leftJoin(sources, eq(sources.id, captureEntries.sourceId))
      .leftJoin(topicGroupTitles, eq(topicGroupTitles.itemId, items.id))
      .where(and(eq(items.status, "processed"), eq(enrichments.isCurrent, true), isNotNull(enrichments.itemId)))
      .orderBy(desc(enrichments.importanceScore), desc(items.publishedAt), desc(items.createdAt))
      .limit(24);
  } finally {
    await client.end();
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

function mapInboxRow(row: InboxRow): InboxItemViewModel {
  const title = row.title?.trim() || "Untitled item";

  return {
    classification: row.classification,
    duplicateOfItemId: extractDuplicateOfItemId(row.metadata),
    id: row.id,
    importanceScore: row.importanceScore,
    noveltyScore: row.noveltyScore,
    publishedAtLabel: row.publishedAt ? timestampFormatter.format(row.publishedAt) : null,
    sourceName: row.sourceName?.trim() || null,
    sourceTopic: row.sourceTopic?.trim() || null,
    sourceTypeLabel: row.sourceType ? formatSourceTypeLabel(row.sourceType) : null,
    summaryShort: selectCompactSummary(row),
    tags: row.tags ?? [],
    title,
    topic: row.topic,
    topicGroupTitle: row.topicGroupTitle,
    url: row.canonicalUrl,
  };
}

function selectCompactSummary(row: InboxRow) {
  const title = normalizeText(row.title);
  const preferredSummary = normalizeText(row.summaryShort);

  if (preferredSummary) {
    const trimmedLegacyPrefix = trimTitlePrefix(preferredSummary, title);

    if (trimmedLegacyPrefix) {
      return clampSummary(trimmedLegacyPrefix);
    }

    if (!isDegenerateSummary(preferredSummary, title)) {
      return clampSummary(preferredSummary);
    }
  }

  const fallbackSummary = firstReadableFallback([row.summaryLong, row.contentText], title);

  return fallbackSummary ? clampSummary(fallbackSummary) : null;
}

function firstReadableFallback(values: Array<string | null>, title: string | null) {
  for (const value of values) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      continue;
    }

    const firstSentence = extractFirstSentence(normalizedValue) ?? normalizedValue;

    if (!isDegenerateSummary(firstSentence, title)) {
      return firstSentence;
    }
  }

  return null;
}

function trimTitlePrefix(summary: string, title: string | null) {
  if (!title) {
    return null;
  }

  const separators = [":", " - ", " – ", " — "];

  for (const separator of separators) {
    const prefix = `${title}${separator}`;

    if (summary.startsWith(prefix)) {
      const remainder = normalizeText(summary.slice(prefix.length));

      if (remainder && !isDegenerateSummary(remainder, title)) {
        return remainder;
      }
    }
  }

  return null;
}

function isDegenerateSummary(summary: string, title: string | null) {
  if (!title) {
    return false;
  }

  return canonicalizeForComparison(summary) === canonicalizeForComparison(title);
}

function extractFirstSentence(value: string) {
  const match = value.match(/^(.+?[.!?])(?:\s|$)/);

  return match?.[1] ?? null;
}

function clampSummary(value: string) {
  if (value.length <= MAX_COMPACT_SUMMARY_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_COMPACT_SUMMARY_LENGTH - 1).trimEnd()}…`;
}

function normalizeText(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized || null;
}

function canonicalizeForComparison(value: string) {
  return value
    .replace(/[.:!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

function extractDuplicateOfItemId(metadata: Record<string, unknown>) {
  const knowledgeProcessing = metadata.knowledgeProcessing;

  if (!knowledgeProcessing || typeof knowledgeProcessing !== "object" || Array.isArray(knowledgeProcessing)) {
    return null;
  }

  const knowledgeProcessingRecord = knowledgeProcessing as Record<string, unknown>;
  const duplicateOfItemId = knowledgeProcessingRecord.duplicateOfItemId;

  return typeof duplicateOfItemId === "string" ? duplicateOfItemId : null;
}

function formatSourceTypeLabel(sourceType: "rss") {
  return sourceType === "rss" ? "RSS" : sourceType;
}

function getInboxUnavailableKind(error: unknown): InboxUnavailableKind | null {
  for (const candidate of walkErrorChain(error)) {
    if (candidate.code === "42501") {
      return "bootstrap";
    }

    if (candidate.code === "ERR_INVALID_URL") {
      return "configuration";
    }

    if (
      candidate.code === "42P01" ||
      candidate.code === "3F000" ||
      candidate.code === "42704"
    ) {
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
        to_regclass('public.item_group_members') is not null as "itemGroupMembersExists"
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

  return `${message} Preview probe: public CREATE=${formatPrivilege(probe.publicCreate)}, public USAGE=${formatPrivilege(probe.publicUsage)}, capture_entries=${formatPresence(probe.captureEntriesExists)}, raw_assets=${formatPresence(probe.rawAssetsExists)}, items=${formatPresence(probe.itemsExists)}, enrichments=${formatPresence(probe.enrichmentsExists)}, item_groups=${formatPresence(probe.itemGroupsExists)}, item_group_members=${formatPresence(probe.itemGroupMembersExists)}.`;
}

async function getUnexpectedUnavailableReason(error: unknown) {
  if (process.env.VERCEL_ENV === "preview") {
    const probe = await loadPreviewInboxProbeResult();

    if (probe) {
      return `Inbox data is temporarily unavailable in this preview environment. Preview probe: public CREATE=${formatPrivilege(probe.publicCreate)}, public USAGE=${formatPrivilege(probe.publicUsage)}, capture_entries=${formatPresence(probe.captureEntriesExists)}, raw_assets=${formatPresence(probe.rawAssetsExists)}, items=${formatPresence(probe.itemsExists)}, enrichments=${formatPresence(probe.enrichmentsExists)}, item_groups=${formatPresence(probe.itemGroupsExists)}, item_group_members=${formatPresence(probe.itemGroupMembersExists)}.`;
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

      continue;
    }

    if (typeof current === "string") {
      yield { message: current };
    }
  }
}
