import { V1_KNOWLEDGE_PIPELINE, type KnowledgeStepName } from "@signal-inbox/core";

export interface ProcessorStepDefinition {
  name: KnowledgeStepName;
  status: "placeholder";
}

export const processorStepDefinitions: ProcessorStepDefinition[] =
  V1_KNOWLEDGE_PIPELINE.map((name) => ({
    name,
    status: "placeholder",
  }));

export const processorsPackageStatus = "placeholder";
