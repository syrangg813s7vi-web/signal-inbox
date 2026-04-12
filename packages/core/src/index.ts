export const APP_NAME = "Signal Inbox";

export const V1_PROCESSOR_ORDER = [
  "dedupe",
  "summarize",
  "classify",
  "group",
] as const;

export type ProcessorName = (typeof V1_PROCESSOR_ORDER)[number];

export interface CoreModuleStatus {
  sourceManager: "pending";
  unifiedIngest: "pending";
  digestGenerator: "pending";
  jobs: "pending";
}

export const coreModuleStatus: CoreModuleStatus = {
  sourceManager: "pending",
  unifiedIngest: "pending",
  digestGenerator: "pending",
  jobs: "pending",
};

export * from "./domain";
