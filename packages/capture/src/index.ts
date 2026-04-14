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
export {
  beginSubmittedUrlExecution,
  completeSubmittedUrlExecution,
  failSubmittedUrlExecution,
  normalizeSubmittedUrl,
  SubmittedUrlValidationError,
  type BeginSubmittedUrlExecutionInput,
  type CompleteSubmittedUrlExecutionInput,
  type SubmittedUrlExecutionRecord,
  type SubmittedUrlFailureAssetInput,
  type SubmittedUrlFailureResult,
  type SubmittedUrlSuccessResult,
} from "./submitted-url";

export const capturePackage = {
  name: "@signal-inbox/capture",
  responsibility: "Source management and capture entry orchestration.",
} as const;
