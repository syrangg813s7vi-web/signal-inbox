export const SOURCE_TYPES = ["rss"] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_STATUSES = ["active", "paused", "error"] as const;

export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export interface Source {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceRef: string;
  sourceUrl?: string;
  status: SourceStatus;
  topic?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SourceSyncState {
  sourceId: string;
  cursor?: string;
  lastSyncedAt?: Date;
  lastSuccessAt?: Date;
  lastErrorAt?: Date;
  lastErrorMessage?: string;
}

export const CAPTURE_ENTRY_TYPES = ["source_sync", "manual_link"] as const;

export type CaptureEntryType = (typeof CAPTURE_ENTRY_TYPES)[number];

export const CAPTURE_ENTRY_STATUSES = [
  "captured",
  "normalized",
  "failed",
] as const;

export type CaptureEntryStatus = (typeof CAPTURE_ENTRY_STATUSES)[number];

export interface CaptureEntry {
  id: string;
  entryType: CaptureEntryType;
  sourceId?: string;
  triggerRef?: string;
  status: CaptureEntryStatus;
  metadata?: Record<string, unknown>;
  capturedAt: Date;
  createdAt: Date;
}

export const RAW_ASSET_TYPES = ["url", "article"] as const;

export type RawAssetType = (typeof RAW_ASSET_TYPES)[number];

export const RAW_ASSET_STATUSES = ["new", "normalized", "failed"] as const;

export type RawAssetStatus = (typeof RAW_ASSET_STATUSES)[number];

export interface RawAsset {
  id: string;
  captureEntryId: string;
  assetType: RawAssetType;
  externalId?: string;
  title?: string;
  author?: string;
  url?: string;
  publishedAt?: Date;
  rawContent: string;
  rawMetadata?: Record<string, unknown>;
  status: RawAssetStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const ITEM_TYPES = ["article"] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_STATUSES = ["new", "processed", "archived"] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export interface Item {
  id: string;
  rawAssetId: string;
  itemType: ItemType;
  title: string;
  canonicalUrl?: string;
  author?: string;
  publishedAt?: Date;
  language?: string;
  contentText: string;
  status: ItemStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Enrichment {
  id: string;
  itemId: string;
  importanceScore?: number;
  noveltyScore?: number;
  summaryShort?: string;
  summaryLong?: string;
  keyPoints?: string[];
  tags?: string[];
  topic?: string;
  classification?: string;
  aiCommentary?: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const ITEM_GROUP_TYPES = ["topic"] as const;

export type ItemGroupType = (typeof ITEM_GROUP_TYPES)[number];

export interface ItemGroup {
  id: string;
  groupType: ItemGroupType;
  title: string;
  summary?: string;
  tag?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  id: string;
  itemId: string;
  title: string;
  contentMd: string;
  summary?: string;
  status: "draft" | "saved";
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const DIGEST_TYPES = ["daily", "weekly"] as const;

export type DigestType = (typeof DIGEST_TYPES)[number];

export interface Digest {
  id: string;
  digestType: DigestType;
  digestDate: string;
  title: string;
  contentMd: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export const KNOWLEDGE_DESTINATION_TYPES = ["notion", "obsidian"] as const;

export type KnowledgeDestinationType =
  (typeof KNOWLEDGE_DESTINATION_TYPES)[number];

export const DESTINATION_STATUSES = ["active", "paused", "error"] as const;

export type DestinationStatus = (typeof DESTINATION_STATUSES)[number];

export interface KnowledgeDestination {
  id: string;
  destinationType: KnowledgeDestinationType;
  name: string;
  targetRef: string;
  status: DestinationStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const REVIEW_OBJECT_TYPES = ["item", "note"] as const;

export type ReviewObjectType = (typeof REVIEW_OBJECT_TYPES)[number];

export interface ReviewObject {
  id: string;
  objectType: ReviewObjectType;
  objectId: string;
  reviewAt: Date;
  status: "pending" | "completed";
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export const DELIVERY_DESTINATION_TYPES = ["feishu"] as const;

export type DeliveryDestinationType =
  (typeof DELIVERY_DESTINATION_TYPES)[number];

export interface DeliveryDestination {
  id: string;
  destinationType: DeliveryDestinationType;
  name: string;
  targetRef: string;
  status: DestinationStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const DELIVERY_CONTENT_TYPES = ["review_object", "digest"] as const;

export type DeliveryContentType = (typeof DELIVERY_CONTENT_TYPES)[number];

export const DELIVERY_LOG_STATUSES = ["success", "failed"] as const;

export type DeliveryLogStatus = (typeof DELIVERY_LOG_STATUSES)[number];

export interface DeliveryLog {
  id: string;
  destinationId: string;
  contentType: DeliveryContentType;
  contentId: string;
  status: DeliveryLogStatus;
  message?: string;
  deliveredAt?: Date;
  createdAt: Date;
}
