import type { Item, KnowledgeStepName, Note } from "@signal-inbox/core";

export interface KnowledgeProcessor {
  name: KnowledgeStepName;
}

export interface KnowledgeResult {
  item: Item;
  note?: Note;
}

export const knowledgePackageStatus = "placeholder";
