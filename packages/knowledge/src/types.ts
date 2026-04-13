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
  noteId: string | null;
  processedAt: string;
  status: "processed";
  summaryShort: string | null;
  syncedDestinationCount: number;
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

export interface NoteBuildInput {
  classification: ClassifyStepResult;
  dedupe: DedupeStepResult;
  item: ProcessableItemRecord;
  score: ScoreStepResult;
  summary: SummarizeStepResult;
}

export interface BuiltNoteResult {
  bodyMd: string;
  highlights: string[];
  metadata: Record<string, unknown>;
  noteType: "reference" | "summary";
  reviewWeight: number;
  tags: string[];
  title: string;
}

export interface KnowledgeDestinationRecord {
  destinationType: "notion" | "obsidian";
  id: string;
  metadata: Record<string, unknown>;
  name: string;
  status: "active" | "disabled" | "error";
  targetRef: string;
}

export interface KnowledgeSyncResult {
  destinationId: string;
  destinationType: KnowledgeDestinationRecord["destinationType"];
  externalRef: string;
  message: string;
  status: "success";
  syncedAt: string;
  targetRef: string;
}
