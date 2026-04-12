export const APP_NAME = "Signal Inbox";

export const V1_KNOWLEDGE_PIPELINE = [
  "score",
  "dedupe",
  "summarize",
  "classify",
  "group",
] as const;

export type KnowledgeStepName = (typeof V1_KNOWLEDGE_PIPELINE)[number];

export interface CoreModuleStatus {
  capture: "pending";
  normalization: "pending";
  knowledge: "pending";
  review: "pending";
  jobs: "pending";
}

export const coreModuleStatus: CoreModuleStatus = {
  capture: "pending",
  normalization: "pending",
  knowledge: "pending",
  review: "pending",
  jobs: "pending",
};

export * from "./domain";
