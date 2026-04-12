import type { CaptureEntry, RawAsset, Source } from "@signal-inbox/core";

export interface CaptureModulePlaceholder {
  sourceManager: "pending";
  captureEntries: "pending";
  rawAssets: "pending";
}

export interface CaptureBatch {
  source: Source;
  entries: CaptureEntry[];
  rawAssets: RawAsset[];
}

export const captureModulePlaceholder: CaptureModulePlaceholder = {
  sourceManager: "pending",
  captureEntries: "pending",
  rawAssets: "pending",
};
