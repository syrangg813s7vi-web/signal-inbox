export const aiTaskKinds = ["summarize", "digest"] as const;

export type AiTaskKind = (typeof aiTaskKinds)[number];
