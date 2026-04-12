export {
  createRssSource,
  deleteSource,
  listRssSources,
  pauseSource,
  reactivateSource,
  SourceConflictError,
  SourceNotFoundError,
  SourceValidationError,
  type CreateRssSourceInput,
  type RssSourceRecord,
  type SourceStatus,
  type SourceSyncStateRecord,
} from "./source-manager";

export const capturePackage = {
  name: "@signal-inbox/capture",
  responsibility: "Source management and capture entry orchestration.",
} as const;
