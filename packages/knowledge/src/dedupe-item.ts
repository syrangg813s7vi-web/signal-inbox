import { and, asc, eq, ne } from "drizzle-orm";

import { enrichments } from "@signal-inbox/db";

import type { DedupeStepResult, ProcessableItemRecord, ScoreStepResult } from "./types";
import { firstNonEmpty, normalizeWhitespace, slugify } from "./utils";

type DatabaseTransaction = Parameters<
  Parameters<import("@signal-inbox/db").SignalInboxDatabase["transaction"]>[0]
>[0];

interface DedupeMetadata {
  canonicalUrlConflict?: string;
}

export async function dedupeItem(
  tx: DatabaseTransaction,
  item: ProcessableItemRecord,
  score: ScoreStepResult,
): Promise<DedupeStepResult> {
  const existingMetadata = item.existingMetadata as DedupeMetadata;
  const canonicalUrl = firstNonEmpty(item.canonicalUrl, existingMetadata.canonicalUrlConflict);
  const titleFingerprint = firstNonEmpty(item.title, item.contentText?.slice(0, 120));

  const dedupeKey = canonicalUrl
    ? `url:${canonicalUrl.toLowerCase()}`
    : `text:${slugify(normalizeWhitespace(titleFingerprint ?? item.id))}`;

  const duplicates = await tx
    .select({
      itemId: enrichments.itemId,
    })
    .from(enrichments)
    .where(and(eq(enrichments.dedupeKey, dedupeKey), ne(enrichments.itemId, item.id)))
    .orderBy(asc(enrichments.createdAt));

  const matchedItemIds = duplicates.map((duplicate) => duplicate.itemId);
  const duplicateOfItemId = matchedItemIds[0] ?? null;

  return {
    dedupeKey,
    duplicateOfItemId,
    matchedItemIds,
    noveltyScore: duplicateOfItemId ? 0 : score.noveltyScore,
  };
}
