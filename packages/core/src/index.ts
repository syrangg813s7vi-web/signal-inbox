export const ARCHITECTURE_DOMAINS = [
  "Capture",
  "Knowledge",
  "Review",
] as const;

export const ARCHITECTURE_LAYERS = [
  "Capture Layer",
  "Normalization Layer",
  "Knowledge Layer",
  "Review Layer",
] as const;

export type ArchitectureDomain = (typeof ARCHITECTURE_DOMAINS)[number];
export type ArchitectureLayer = (typeof ARCHITECTURE_LAYERS)[number];
export type ArchitectureName = ArchitectureDomain | ArchitectureLayer;

export {
  runNormalizeRawAssetJob,
  NormalizeRawAssetJobError,
  NormalizationValidationError,
  RawAssetNotFoundError,
  type RunNormalizeRawAssetJobInput,
} from "./normalize-raw-asset-job";

export {
  runProcessItemJob,
  ProcessItemJobError,
  ItemNotFoundError,
  ItemProcessingValidationError,
  type RunProcessItemJobInput,
} from "./process-item-job";

export {
  runRssSourceSyncJob,
  SourceSyncJobError,
  type RunRssSourceSyncJobInput,
} from "./capture-sync-job";
