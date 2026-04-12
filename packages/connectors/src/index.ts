import type { ItemType, Source, SourceSyncState } from "@signal-inbox/core";

export interface ConnectorRunInput {
  source: Source;
  syncState?: SourceSyncState;
}

export interface NormalizedConnectorRecord {
  externalId: string;
  itemType: ItemType;
  title?: string;
  author?: string;
  url?: string;
  publishedAt?: Date;
  rawContent: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectorResult {
  records: NormalizedConnectorRecord[];
  nextCursor?: string;
}

export const connectorsPackageStatus = "placeholder";
