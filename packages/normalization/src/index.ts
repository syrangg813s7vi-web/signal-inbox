import type { Item, RawAsset } from "@signal-inbox/core";

export interface NormalizationRequest {
  rawAsset: RawAsset;
}

export interface NormalizationResult {
  item: Item;
}

export const normalizationPackageStatus = "placeholder";
