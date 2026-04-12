import type {
  RawAssetType,
  Source,
  SourceSyncState,
} from "@signal-inbox/core";

export interface ConnectorRunInput {
  source: Source;
  syncState?: SourceSyncState;
}

export interface CapturedRecord {
  externalId: string;
  assetType: RawAssetType;
  title?: string;
  author?: string;
  url?: string;
  publishedAt?: Date;
  rawContent: string;
  rawMetadata?: Record<string, unknown>;
}

export interface ConnectorResult {
  records: CapturedRecord[];
  nextCursor?: string;
}

export const connectorsPackageStatus = "placeholder";
