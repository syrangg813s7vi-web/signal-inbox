import type { ProcessableItemRecord, SummarizeStepResult } from "./types";
import { firstNonEmpty, normalizeWhitespace, splitSentences } from "./utils";

const MAX_SUMMARY_LENGTH = 220;

export function summarizeItem(item: ProcessableItemRecord): SummarizeStepResult {
  const title = firstNonEmpty(item.title);
  const content = firstNonEmpty(item.contentText);
  const firstSentence = content ? splitSentences(content)[0] ?? content : null;

  const summary = [title, firstSentence]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(": ");

  if (!summary) {
    return {
      summaryShort: null,
    };
  }

  const normalizedSummary = normalizeWhitespace(summary);

  return {
    summaryShort:
      normalizedSummary.length <= MAX_SUMMARY_LENGTH
        ? normalizedSummary
        : `${normalizedSummary.slice(0, MAX_SUMMARY_LENGTH - 1).trimEnd()}…`,
  };
}
