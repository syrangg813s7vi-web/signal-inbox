export {
  createRssSource,
  deleteSource,
  getRssSource,
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
export {
  beginSourceSyncExecution,
  completeRssSourceSyncExecution,
  failSourceSyncExecution,
  SourceSyncValidationError,
  type BeginSourceSyncExecutionInput,
  type CompleteRssSourceSyncExecutionInput,
  type SourceSyncExecutionRecord,
  type SourceSyncFailureResult,
  type SourceSyncSuccessResult,
} from "./source-sync";

export const capturePackage = {
  name: "@signal-inbox/capture",
  responsibility: "Source management and capture entry orchestration.",
} as const;
