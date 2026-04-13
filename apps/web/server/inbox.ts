import { and, desc, eq, isNotNull } from "drizzle-orm";

import {
  createDbFromClient,
  createSqlClient,
  enrichments,
  itemGroupMembers,
  itemGroups,
  items,
  runMigrations,
} from "@signal-inbox/db";

export interface InboxItemViewModel {
  classification: string | null;
  duplicateOfItemId: string | null;
  id: string;
  importanceScore: number | null;
  noveltyScore: number | null;
  publishedAtLabel: string | null;
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
  id: string;
  importanceScore: number | null;
  metadata: Record<string, unknown>;
  noveltyScore: number | null;
  publishedAt: Date | null;
  summaryShort: string | null;
  tags: string[] | null;
  title: string | null;
  topic: string | null;
  topicGroupTitle: string | null;
}

type InboxUnavailableKind = "configuration" | "connection" | "schema" | "unknown";

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
        unavailableReason: getUnavailableReason(unavailableKind),
      };
    }

    console.error("inbox view model failed", {
      message: error instanceof Error ? error.message : "Unknown inbox failure.",
    });

    return {
      isAvailable: false,
      items: [],
      unavailableReason: getUnexpectedUnavailableReason(error),
    };
  }
}

async function loadInboxRows() {
  const client = createSqlClient();
  const db = createDbFromClient(client);

  try {
    return await db
      .select({
        canonicalUrl: items.canonicalUrl,
        classification: enrichments.classification,
        id: items.id,
        importanceScore: enrichments.importanceScore,
        metadata: items.metadata,
        noveltyScore: enrichments.noveltyScore,
        publishedAt: items.publishedAt,
        summaryShort: enrichments.summaryShort,
        tags: enrichments.tags,
        title: items.title,
        topic: enrichments.topic,
        topicGroupTitle: itemGroups.title,
      })
      .from(items)
      .innerJoin(enrichments, eq(enrichments.itemId, items.id))
      .leftJoin(itemGroupMembers, eq(itemGroupMembers.itemId, items.id))
      .leftJoin(
        itemGroups,
        and(eq(itemGroups.id, itemGroupMembers.groupId), eq(itemGroups.groupType, "topic")),
      )
      .where(and(eq(items.status, "processed"), isNotNull(enrichments.itemId)))
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
      await ensureInboxStorageSchema();
      return operation();
    }

    throw error;
  }
}

function mapInboxRow(row: InboxRow): InboxItemViewModel {
  return {
    classification: row.classification,
    duplicateOfItemId: extractDuplicateOfItemId(row.metadata),
    id: row.id,
    importanceScore: row.importanceScore,
    noveltyScore: row.noveltyScore,
    publishedAtLabel: row.publishedAt ? timestampFormatter.format(row.publishedAt) : null,
    summaryShort: row.summaryShort,
    tags: row.tags ?? [],
    title: row.title?.trim() || "Untitled item",
    topic: row.topic,
    topicGroupTitle: row.topicGroupTitle,
    url: row.canonicalUrl,
  };
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

function getInboxUnavailableKind(error: unknown): InboxUnavailableKind | null {
  for (const candidate of walkErrorChain(error)) {
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

    if (message.includes("database_url must be set")) {
      return "configuration";
    }

    if (message.includes("connect")) {
      return "connection";
    }
  }

  return null;
}

function getUnavailableReason(kind: InboxUnavailableKind) {
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

function getUnexpectedUnavailableReason(error: unknown) {
  if (process.env.VERCEL_ENV === "preview") {
    return "Inbox data is temporarily unavailable in this preview environment.";
  }

  if (error instanceof Error && error.message) {
    return `Inbox data is unavailable: ${error.message}`;
  }

  return "Inbox data is unavailable because an unexpected server error occurred.";
}

function shouldAttemptPreviewSchemaBootstrap() {
  return process.env.VERCEL_ENV === "preview";
}

async function ensureInboxStorageSchema() {
  if (!inboxStorageBootstrapPromise) {
    inboxStorageBootstrapPromise = runMigrations().finally(() => {
      inboxStorageBootstrapPromise = null;
    });
  }

  await inboxStorageBootstrapPromise;
}

function walkErrorChain(error: unknown) {
  const seen = new Set<unknown>();
  const chain: Array<{ code?: string; message?: string }> = [];
  let current = error;

  while (current && !seen.has(current)) {
    seen.add(current);

    if (typeof current === "object") {
      const candidate = current as { cause?: unknown; code?: string; message?: string };
      chain.push(candidate);
      current = candidate.cause;
      continue;
    }

    break;
  }

  return chain;
}
