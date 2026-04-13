export {
  processItem,
  recordItemProcessingFailure,
  ItemNotFoundError,
  ItemProcessingValidationError,
} from "./process-item";
export {
  V1_PROCESSING_ORDER,
  type KnowledgeDestinationRecord,
  type KnowledgeSyncResult,
  type ProcessItemInput,
  type ProcessItemResult,
} from "./types";

export const knowledgePackage = {
  name: "@signal-inbox/knowledge",
  responsibility: "Item enrichment, note creation, and knowledge sync.",
} as const;
