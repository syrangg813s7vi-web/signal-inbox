export const V1_PROCESSING_ORDER = [
  "score",
  "dedupe",
  "summarize",
  "classify",
  "group",
] as const;

export type KnowledgeProcessingStep = (typeof V1_PROCESSING_ORDER)[number];

export interface ProcessItemInput {
  itemId: string;
}

export interface ProcessItemResult {
  classification: string | null;
  duplicateOfItemId: string | null;
  enrichmentId: string;
  groupId: string | null;
  itemId: string;
  processedAt: string;
  status: "processed";
  summaryShort: string | null;
  topic: string | null;
}

export interface ScoreStepResult {
  importanceScore: number;
  noveltyScore: number;
  rationale: string[];
}

export interface DedupeStepResult {
  dedupeKey: string;
  duplicateOfItemId: string | null;
  matchedItemIds: string[];
  noveltyScore: number;
}

export interface SummarizeStepResult {
  summaryShort: string | null;
}

export interface ClassifyStepResult {
  classification: string | null;
  tags: string[];
  topic: string | null;
}

export interface GroupStepResult {
  groupId: string | null;
  tag: string | null;
  title: string | null;
}

export interface ProcessableItemRecord {
  author: string | null;
  canonicalUrl: string | null;
  contentText: string | null;
  existingMetadata: Record<string, unknown>;
  id: string;
  language: string | null;
  publishedAt: Date | null;
  sourceTopic: string | null;
  title: string | null;
}
