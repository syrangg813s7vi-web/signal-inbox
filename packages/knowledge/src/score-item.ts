import type { ProcessableItemRecord, ScoreStepResult } from "./types";
import { clampScore } from "./utils";

export function scoreItem(item: ProcessableItemRecord): ScoreStepResult {
  let importanceScore = 0.3;
  let noveltyScore = 0.75;
  const rationale: string[] = [];

  const contentLength = item.contentText?.trim().length ?? 0;
  const ageInDays = item.publishedAt
    ? (Date.now() - item.publishedAt.getTime()) / (1000 * 60 * 60 * 24)
    : null;
  const titleLower = item.title?.toLowerCase() ?? "";
  const contentLower = item.contentText?.toLowerCase() ?? "";
  const sourceTopicLower = item.sourceTopic?.toLowerCase() ?? "";

  if (item.title?.trim()) {
    importanceScore += 0.1;
    rationale.push("title_present");
  }

  if (contentLength >= 280) {
    importanceScore += 0.15;
    rationale.push("substantive_content");
  }

  if (contentLength >= 1200) {
    importanceScore += 0.1;
    rationale.push("long_form");
  }

  if (ageInDays !== null && ageInDays <= 7) {
    importanceScore += 0.1;
    rationale.push("recent");
  }

  if (item.sourceTopic?.trim()) {
    importanceScore += 0.1;
    rationale.push("source_topic_present");
  }

  if (/(ai|llm|model|agent|openai|anthropic)/.test(`${titleLower} ${contentLower} ${sourceTopicLower}`)) {
    importanceScore += 0.1;
    rationale.push("high_signal_ai_topic");
  }

  if (/(summary|roundup|linkdump)/.test(`${titleLower} ${contentLower}`)) {
    noveltyScore -= 0.15;
    rationale.push("aggregated_content_penalty");
  }

  return {
    importanceScore: clampScore(importanceScore),
    noveltyScore: clampScore(noveltyScore),
    rationale,
  };
}
