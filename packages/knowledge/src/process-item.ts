import { and, eq, sql } from "drizzle-orm";

import {
  enrichItemWithModel,
  ensureKnowledgeEnrichmentSummaryShort,
  type KnowledgeEnrichmentOutput,
} from "@signal-inbox/ai";

import {
  captureEntries,
  createDbFromClient,
  createSqlClient,
  enrichments,
  items,
  notes,
  rawAssets,
  sources,
} from "@signal-inbox/db";

import { classifyItem } from "./classify-item";
import { dedupeItem } from "./dedupe-item";
import { groupItem } from "./group-item";
import { syncNoteToKnowledgeDestinations } from "./knowledge-sync";
import { buildNoteIfPreservationWorthy } from "./note-builder";
import { scoreItem } from "./score-item";
import {
  V1_PROCESSING_ORDER,
  type CurrentEnrichmentRecord,
  type ProcessItemInput,
  type ProcessItemResult,
  type ProcessableItemRecord,
} from "./types";

type DatabaseTransaction = Parameters<
  Parameters<ReturnType<typeof createDbFromClient>["transaction"]>[0]
>[0];

interface ItemRow {
  author: string | null;
  canonicalUrl: string | null;
  contentText: string | null;
  id: string;
  language: string | null;
  metadata: Record<string, unknown>;
  publishedAt: Date | null;
  sourceTopic: string | null;
  status: "new" | "processed" | "archived";
  title: string | null;
}

export class ItemNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemNotFoundError";
  }
}

export class ItemProcessingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemProcessingValidationError";
  }
}

export async function processItem(
  input: ProcessItemInput,
  databaseUrl?: string,
): Promise<ProcessItemResult> {
  const itemId = input.itemId.trim();

  if (!itemId) {
    throw new ItemProcessingValidationError("Item id is required.");
  }

  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);

  try {
    return await db.transaction(async (tx) => {
      await lockItemForProcessing(tx, itemId);

      const item = await getProcessableItem(tx, itemId);

      if (!item) {
        throw new ItemNotFoundError(`Item ${itemId} was not found.`);
      }

      const [existingNote] = await tx
        .select({
          id: notes.id,
        })
        .from(notes)
        .where(eq(notes.itemId, item.id));

      const [existingEnrichment] = await tx
        .select({
          classification: enrichments.classification,
          id: enrichments.id,
          summaryShort: enrichments.summaryShort,
          topic: enrichments.topic,
        })
        .from(enrichments)
        .where(and(eq(enrichments.itemId, item.id), eq(enrichments.isCurrent, true)));

      if (item.status === "processed" && existingEnrichment && !input.reprocess) {
        const processedAt = extractProcessedAt(item.metadata) ?? new Date().toISOString();

        return {
          classification: existingEnrichment.classification,
          duplicateOfItemId: extractDuplicateOfItemId(item.metadata),
          enrichmentId: existingEnrichment.id,
          groupId: extractGroupId(item.metadata),
          itemId: item.id,
          noteId: existingNote?.id ?? extractNoteId(item.metadata),
          processedAt,
          status: "processed",
          summaryShort: existingEnrichment.summaryShort,
          syncedDestinationCount: extractSyncedDestinationCount(item.metadata),
          topic: existingEnrichment.topic,
        };
      }

      return await runKnowledgePipeline(tx, item, existingEnrichment ?? null, input);
    });
  } finally {
    await client.end();
  }
}

export async function recordItemProcessingFailure(
  input: {
    itemId: string;
    message: string;
  },
  databaseUrl?: string,
) {
  const itemId = input.itemId.trim();

  if (!itemId) {
    return null;
  }

  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const failedAt = new Date().toISOString();

  try {
    const [existingItem] = await db
      .select({
        id: items.id,
        metadata: items.metadata,
      })
      .from(items)
      .where(eq(items.id, itemId));

    if (!existingItem) {
      return null;
    }

    await db
      .update(items)
      .set({
        metadata: {
          ...existingItem.metadata,
          knowledgeProcessing: {
            ...extractKnowledgeProcessingMetadata(existingItem.metadata),
            failedAt,
            lastCompletedStep: null,
            lastError: input.message,
            order: V1_PROCESSING_ORDER,
            pipelineVersion: "v1",
            status: "failed",
          },
        },
        updatedAt: new Date(failedAt),
      })
      .where(eq(items.id, itemId));

    return {
      failedAt,
      itemId,
      message: input.message,
    };
  } finally {
    await client.end();
  }
}

async function runKnowledgePipeline(
  tx: DatabaseTransaction,
  item: ItemRow,
  existingEnrichment: CurrentEnrichmentRecord | null,
  input: ProcessItemInput,
): Promise<ProcessItemResult> {
  const processableItem: ProcessableItemRecord = {
    author: item.author,
    canonicalUrl: item.canonicalUrl,
    contentText: item.contentText,
    existingMetadata: item.metadata,
    id: item.id,
    language: item.language,
    publishedAt: item.publishedAt,
    sourceTopic: item.sourceTopic,
    title: item.title,
  };

  const score = scoreItem(processableItem);
  const dedupe = await dedupeItem(tx, processableItem, score);
  const enrichment = await enrichItemWithModel(
    {
      config: input.knowledgeEnrichmentConfig,
      item: {
        author: processableItem.author,
        canonicalUrl: processableItem.canonicalUrl,
        contentText: processableItem.contentText,
        id: processableItem.id,
        language: processableItem.language,
        publishedAt: processableItem.publishedAt?.toISOString() ?? null,
        sourceTopic: processableItem.sourceTopic,
        title: processableItem.title,
      },
    },
    input.knowledgeEnrichmentRunner,
  );
  const knowledgeOutput = applyKnowledgeLayerPostProcessing(dedupe, enrichment.output);

  ensureKnowledgeEnrichmentSummaryShort({
    item: {
      title: processableItem.title,
    },
    summaryShort: knowledgeOutput.summary.short,
  });

  const group = await groupItem(tx, {
    classification: {
      classification: knowledgeOutput.classification.label,
      tags: knowledgeOutput.tags,
      topic: knowledgeOutput.classification.topic,
    },
    itemId: item.id,
  });
  const builtNote = buildNoteIfPreservationWorthy({
    dedupe,
    enrichment: knowledgeOutput,
    item: processableItem,
    score,
  });
  const processedAt = new Date();
  let noteId: string | null = null;
  let syncedDestinationCount = 0;
  const processingMetadata = {
    completedAt: processedAt.toISOString(),
    generation: {
      maxOutputTokens: enrichment.config.maxOutputTokens,
      model: enrichment.config.model,
      promptVersion: enrichment.config.promptVersion,
      provider: enrichment.config.provider,
      retryAttempts: enrichment.config.retryAttempts,
      retryBackoffMs: enrichment.config.retryBackoffMs,
      temperature: enrichment.config.temperature,
      timeoutMs: enrichment.config.timeoutMs,
    },
    duplicateOfItemId: dedupe.duplicateOfItemId,
    groupId: group.groupId,
    lastCompletedStep: "preserve",
    lastError: null,
    matchedItemIds: dedupe.matchedItemIds,
    order: V1_PROCESSING_ORDER,
    pipelineVersion: "v1",
    processedAt: processedAt.toISOString(),
    status: "processed",
    noteCreated: false,
    noteId: null as string | null,
    noteStatus: builtNote ? "created" : "skipped",
    syncedDestinationCount: 0,
    steps: {
      classify: {
        classification: knowledgeOutput.classification.label,
        tags: knowledgeOutput.tags,
        topic: knowledgeOutput.classification.topic,
      },
      dedupe: {
        dedupeKey: dedupe.dedupeKey,
        duplicateOfItemId: dedupe.duplicateOfItemId,
        matchedItemIds: dedupe.matchedItemIds,
      },
      group: {
        groupId: group.groupId,
        tag: group.tag,
        title: group.title,
      },
      preserve: {
        noteDraftAvailable: Boolean(knowledgeOutput.noteDraft),
        noteId: null as string | null,
        noteStatus: builtNote ? "created" : "skipped",
        preserveRecommendation: knowledgeOutput.preserveRecommendation,
      },
      score: {
        importanceScore: score.importanceScore,
        noveltyScore: dedupe.noveltyScore,
        rationale: score.rationale,
      },
      summarize: {
        keyPoints: knowledgeOutput.keyPoints,
        summaryLong: knowledgeOutput.summary.long,
        summaryShort: knowledgeOutput.summary.short,
        whyItMatters: knowledgeOutput.whyItMatters,
      },
    },
  };

  if (builtNote) {
    const [upsertedNote] = await tx
      .insert(notes)
      .values({
        bodyMd: builtNote.bodyMd,
        highlights: builtNote.highlights,
        itemId: item.id,
        metadata: builtNote.metadata,
        noteType: builtNote.noteType,
        reviewWeight: builtNote.reviewWeight,
        tags: builtNote.tags,
        title: builtNote.title,
        updatedAt: processedAt,
      })
      .onConflictDoUpdate({
        set: {
          bodyMd: builtNote.bodyMd,
          highlights: builtNote.highlights,
          metadata: builtNote.metadata,
          noteType: builtNote.noteType,
          reviewWeight: builtNote.reviewWeight,
          tags: builtNote.tags,
          title: builtNote.title,
          updatedAt: processedAt,
        },
        target: notes.itemId,
      })
      .returning({
        id: notes.id,
        metadata: notes.metadata,
      });

    const syncResults = await syncNoteToKnowledgeDestinations(tx, {
      ...builtNote,
      id: upsertedNote.id,
    });

    noteId = upsertedNote.id;
    syncedDestinationCount = syncResults.length;

    await tx
      .update(notes)
      .set({
        metadata: {
          ...upsertedNote.metadata,
          ...builtNote.metadata,
          sync: {
            destinations: Object.fromEntries(
              syncResults.map((result) => [
                result.destinationType,
                {
                  destinationId: result.destinationId,
                  externalRef: result.externalRef,
                  message: result.message,
                  status: result.status,
                  syncedAt: result.syncedAt,
                  targetRef: result.targetRef,
                },
              ]),
            ),
            lastAttemptedAt: processedAt.toISOString(),
            lastSucceededAt: syncResults.at(-1)?.syncedAt ?? processedAt.toISOString(),
          },
        },
        updatedAt: processedAt,
      })
      .where(eq(notes.id, upsertedNote.id));

    processingMetadata.noteCreated = true;
    processingMetadata.noteId = upsertedNote.id;
    processingMetadata.noteStatus = "created";
    processingMetadata.syncedDestinationCount = syncResults.length;
    processingMetadata.steps.preserve.noteId = upsertedNote.id;
    processingMetadata.steps.preserve.noteStatus = "created";
  }

  if (existingEnrichment) {
    await tx
      .update(enrichments)
      .set({
        isCurrent: false,
        metadata: {
          supersededAt: processedAt.toISOString(),
        },
        supersededAt: processedAt,
        updatedAt: processedAt,
      })
      .where(and(eq(enrichments.itemId, item.id), eq(enrichments.isCurrent, true)));
  }

  const [upsertedEnrichment] = await tx
    .insert(enrichments)
    .values({
      classification: knowledgeOutput.classification.label,
      dedupeKey: dedupe.dedupeKey,
      importanceScore: knowledgeOutput.importanceScore,
      isCurrent: true,
      itemId: item.id,
      keyPoints: knowledgeOutput.keyPoints,
      metadata: processingMetadata,
      noteDraft: knowledgeOutput.noteDraft,
      noveltyScore: knowledgeOutput.noveltyScore,
      preserveRecommendation: knowledgeOutput.preserveRecommendation,
      summaryLong: knowledgeOutput.summary.long,
      summaryShort: knowledgeOutput.summary.short,
      tags: knowledgeOutput.tags,
      topic: knowledgeOutput.classification.topic,
      updatedAt: processedAt,
      whyItMatters: knowledgeOutput.whyItMatters,
    })
    .returning({
      id: enrichments.id,
    });

  await tx
    .update(items)
    .set({
      metadata: {
        ...item.metadata,
        knowledgeProcessing: {
          ...processingMetadata,
          enrichmentId: upsertedEnrichment.id,
        },
      },
      status: "processed",
      updatedAt: processedAt,
    })
    .where(and(eq(items.id, item.id), eq(items.status, item.status)));

  return {
    classification: knowledgeOutput.classification.label,
    duplicateOfItemId: dedupe.duplicateOfItemId,
    enrichmentId: upsertedEnrichment.id,
    groupId: group.groupId,
    itemId: item.id,
    noteId,
    processedAt: processedAt.toISOString(),
    status: "processed",
    summaryShort: knowledgeOutput.summary.short,
    syncedDestinationCount,
    topic: knowledgeOutput.classification.topic,
  };
}

async function getProcessableItem(
  tx: DatabaseTransaction,
  itemId: string,
): Promise<ItemRow | null> {
  const [item] = await tx
    .select({
      author: items.author,
      canonicalUrl: items.canonicalUrl,
      contentText: items.contentText,
      id: items.id,
      language: items.language,
      metadata: items.metadata,
      publishedAt: items.publishedAt,
      sourceTopic: sources.topic,
      status: items.status,
      title: items.title,
    })
    .from(items)
    .leftJoin(rawAssets, eq(rawAssets.id, items.rawAssetId))
    .leftJoin(captureEntries, eq(captureEntries.id, rawAssets.captureEntryId))
    .leftJoin(sources, eq(sources.id, captureEntries.sourceId))
    .where(eq(items.id, itemId));

  return item ?? null;
}

async function lockItemForProcessing(tx: DatabaseTransaction, itemId: string) {
  await tx.execute(sql`select ${items.id} from ${items} where ${items.id} = ${itemId} for update`);
}

function extractKnowledgeProcessingMetadata(metadata: Record<string, unknown>) {
  const value = metadata.knowledgeProcessing;

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function extractProcessedAt(metadata: Record<string, unknown>) {
  const knowledgeProcessing = extractKnowledgeProcessingMetadata(metadata);
  const processedAt = knowledgeProcessing.processedAt;

  return typeof processedAt === "string" ? processedAt : null;
}

function extractDuplicateOfItemId(metadata: Record<string, unknown>) {
  const knowledgeProcessing = extractKnowledgeProcessingMetadata(metadata);
  const duplicateOfItemId = knowledgeProcessing.duplicateOfItemId;

  return typeof duplicateOfItemId === "string" ? duplicateOfItemId : null;
}

function extractGroupId(metadata: Record<string, unknown>) {
  const knowledgeProcessing = extractKnowledgeProcessingMetadata(metadata);
  const groupId = knowledgeProcessing.groupId;

  return typeof groupId === "string" ? groupId : null;
}

function extractNoteId(metadata: Record<string, unknown>) {
  const knowledgeProcessing = extractKnowledgeProcessingMetadata(metadata);
  const noteId = knowledgeProcessing.noteId;

  return typeof noteId === "string" ? noteId : null;
}

function extractSyncedDestinationCount(metadata: Record<string, unknown>) {
  const knowledgeProcessing = extractKnowledgeProcessingMetadata(metadata);
  const syncedDestinationCount = knowledgeProcessing.syncedDestinationCount;

  return typeof syncedDestinationCount === "number" ? syncedDestinationCount : 0;
}

function applyKnowledgeLayerPostProcessing(
  dedupe: Awaited<ReturnType<typeof dedupeItem>>,
  output: KnowledgeEnrichmentOutput,
): KnowledgeEnrichmentOutput {
  if (!dedupe.duplicateOfItemId) {
    return output;
  }

  return {
    ...output,
    noveltyScore: 0,
    preserveRecommendation: "discard",
  };
}
