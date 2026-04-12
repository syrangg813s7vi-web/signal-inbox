export const SOURCE_TYPES = ["rss", "twitter_list", "wechat"] as const;

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

export const ITEM_TYPES = ["article", "tweet", "video", "post"] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_STATUSES = ["new", "processed", "archived"] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export interface Item {
  id: string;
  sourceId: string;
  externalId: string;
  itemType: ItemType;
  title?: string;
  author?: string;
  url?: string;
  publishedAt?: Date;
  rawContent: string;
  cleanContent?: string;
  summary?: string;
  language?: string;
  tags: string[];
  topic?: string;
  status: ItemStatus;
  importanceScore?: number;
  dedupeHash?: string;
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

export const DESTINATION_TYPES = ["notion", "obsidian", "feishu"] as const;

export type DestinationType = (typeof DESTINATION_TYPES)[number];

export const DESTINATION_STATUSES = ["active", "paused", "error"] as const;

export type DestinationStatus = (typeof DESTINATION_STATUSES)[number];

export interface Destination {
  id: string;
  destinationType: DestinationType;
  name: string;
  targetRef: string;
  status: DestinationStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const DELIVERY_CONTENT_TYPES = ["item", "digest"] as const;

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
