export const v1ProcessorOrder = [
  "dedupe",
  "summarize",
  "classify",
  "group"
] as const;

export type V1ProcessorStep = (typeof v1ProcessorOrder)[number];
