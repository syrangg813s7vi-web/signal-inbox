import { desc, eq } from "drizzle-orm";

import {
  bootstrapKnowledgeStorageSchema,
  captureEntries,
  createDbFromClient,
  createSqlClient,
  items,
  knowledgeDestinations,
  notes,
  rawAssets,
  sources,
} from "@signal-inbox/db";

export interface KnowledgeDestinationStatusViewModel {
  destinationType: "notion" | "obsidian";
  externalRef: string;
  message: string;
  status: string;
  syncedAt: string | null;
}

export interface KnowledgeNoteViewModel {
  bodyPreview: string;
  destinationStatuses: KnowledgeDestinationStatusViewModel[];
  itemId: string;
  publishedAtLabel: string | null;
  reviewWeightLabel: string;
  sourceName: string | null;
  tags: string[];
  title: string;
  topic: string | null;
  typeLabel: string;
}

export interface KnowledgePageViewModel {
  destinations: Array<{
    id: string;
    name: string;
    status: "active" | "disabled" | "error";
    targetRef: string;
    typeLabel: string;
  }>;
  isAvailable: boolean;
  notes: KnowledgeNoteViewModel[];
  unavailableReason: string | null;
}

interface KnowledgeRow {
  bodyMd: string;
  itemId: string;
  metadata: Record<string, unknown>;
  noteType: "reference" | "summary";
  publishedAt: Date | null;
  reviewWeight: number | null;
  sourceName: string | null;
  tags: string[];
  title: string;
  topic: Record<string, unknown>;
}

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export async function getKnowledgePageViewModel(): Promise<KnowledgePageViewModel> {
  try {
    await bootstrapKnowledgeStorageSchema();
    const [noteRows, destinationRows] = await Promise.all([loadKnowledgeRows(), loadDestinationRows()]);

    return {
      destinations: destinationRows,
      isAvailable: true,
      notes: noteRows.map(mapKnowledgeRow),
      unavailableReason: null,
    };
  } catch (error) {
    return {
      destinations: [],
      isAvailable: false,
      notes: [],
      unavailableReason: getUnavailableReason(error),
    };
  }
}

async function loadKnowledgeRows() {
  const client = createSqlClient();
  const db = createDbFromClient(client);

  try {
    return await db
      .select({
        bodyMd: notes.bodyMd,
        itemId: notes.itemId,
        metadata: notes.metadata,
        noteType: notes.noteType,
        publishedAt: items.publishedAt,
        reviewWeight: notes.reviewWeight,
        sourceName: sources.name,
        tags: notes.tags,
        title: notes.title,
        topic: items.metadata,
      })
      .from(notes)
      .innerJoin(items, eq(items.id, notes.itemId))
      .leftJoin(rawAssets, eq(rawAssets.id, items.rawAssetId))
      .leftJoin(captureEntries, eq(captureEntries.id, rawAssets.captureEntryId))
      .leftJoin(sources, eq(sources.id, captureEntries.sourceId))
      .orderBy(desc(notes.createdAt));
  } finally {
    await client.end();
  }
}

async function loadDestinationRows() {
  const client = createSqlClient();
  const db = createDbFromClient(client);

  try {
    return await db
      .select({
        id: knowledgeDestinations.id,
        name: knowledgeDestinations.name,
        status: knowledgeDestinations.status,
        targetRef: knowledgeDestinations.targetRef,
        typeLabel: knowledgeDestinations.destinationType,
      })
      .from(knowledgeDestinations)
      .orderBy(knowledgeDestinations.destinationType);
  } finally {
    await client.end();
  }
}

function mapKnowledgeRow(row: KnowledgeRow): KnowledgeNoteViewModel {
  const syncDestinations = extractDestinationStatuses(row.metadata);

  return {
    bodyPreview: extractBodyPreview(row.bodyMd),
    destinationStatuses: syncDestinations,
    itemId: row.itemId,
    publishedAtLabel: row.publishedAt ? timestampFormatter.format(row.publishedAt) : null,
    reviewWeightLabel: row.reviewWeight === null ? "n/a" : row.reviewWeight.toFixed(2),
    sourceName: row.sourceName?.trim() || null,
    tags: row.tags ?? [],
    title: row.title,
    topic: extractTopic(row.topic),
    typeLabel: row.noteType === "summary" ? "Summary note" : "Reference note",
  };
}

function extractDestinationStatuses(
  metadata: Record<string, unknown>,
): KnowledgeDestinationStatusViewModel[] {
  const sync = metadata.sync;

  if (!sync || typeof sync !== "object" || Array.isArray(sync)) {
    return [];
  }

  const destinations = (sync as Record<string, unknown>).destinations;

  if (!destinations || typeof destinations !== "object" || Array.isArray(destinations)) {
    return [];
  }

  return Object.entries(destinations)
    .map(([destinationType, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
      }

      const record = value as Record<string, unknown>;

      if (typeof record.externalRef !== "string" || typeof record.message !== "string") {
        return null;
      }

      return {
        destinationType: destinationType === "notion" ? "notion" : "obsidian",
        externalRef: record.externalRef,
        message: record.message,
        status: typeof record.status === "string" ? record.status : "unknown",
        syncedAt: typeof record.syncedAt === "string" ? record.syncedAt : null,
      };
    })
    .filter((value): value is KnowledgeDestinationStatusViewModel => value !== null);
}

function extractBodyPreview(bodyMd: string) {
  const preview = bodyMd
    .replace(/^# .+\n+/m, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (preview.length <= 220) {
    return preview;
  }

  return `${preview.slice(0, 219).trimEnd()}…`;
}

function getUnavailableReason(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Knowledge data is unavailable in this environment.";
}

function extractTopic(metadata: Record<string, unknown>) {
  const knowledgeProcessing = metadata.knowledgeProcessing;

  if (!knowledgeProcessing || typeof knowledgeProcessing !== "object" || Array.isArray(knowledgeProcessing)) {
    return null;
  }

  const steps = (knowledgeProcessing as Record<string, unknown>).steps;

  if (!steps || typeof steps !== "object" || Array.isArray(steps)) {
    return null;
  }

  const classify = (steps as Record<string, unknown>).classify;

  if (!classify || typeof classify !== "object" || Array.isArray(classify)) {
    return null;
  }

  const topic = (classify as Record<string, unknown>).topic;

  return typeof topic === "string" ? topic : null;
}
