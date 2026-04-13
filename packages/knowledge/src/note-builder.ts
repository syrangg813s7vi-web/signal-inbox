import type { BuiltNoteResult, NoteBuildInput } from "./types";
import { clampScore, firstNonEmpty, normalizeWhitespace, splitSentences } from "./utils";

const MIN_IMPORTANCE_FOR_NOTE = 0.65;
const MIN_NOVELTY_FOR_NOTE = 0.35;

export function buildNoteIfPreservationWorthy(input: NoteBuildInput): BuiltNoteResult | null {
  if (input.dedupe.duplicateOfItemId) {
    return null;
  }

  if (input.score.importanceScore < MIN_IMPORTANCE_FOR_NOTE) {
    return null;
  }

  if (input.dedupe.noveltyScore < MIN_NOVELTY_FOR_NOTE) {
    return null;
  }

  const title =
    firstNonEmpty(input.item.title, input.summary.summaryShort, input.classification.topic) ??
    "Preserved note";
  const excerpt = buildExcerpt(input.item.contentText);
  const highlights = uniqueNonEmpty([
    input.summary.summaryShort,
    excerpt,
    input.classification.topic,
  ]).slice(0, 3);
  const noteType =
    input.classification.classification === "research" || input.classification.classification === "tutorial"
      ? "summary"
      : "reference";
  const reviewWeight = clampScore((input.score.importanceScore + input.dedupe.noveltyScore) / 2);
  const bodyLines = [
    `# ${title}`,
    "",
    input.summary.summaryShort ? input.summary.summaryShort : "Preserved from the knowledge pipeline.",
    "",
    "## Why it was preserved",
    "",
    `- Importance score: ${input.score.importanceScore.toFixed(2)}`,
    `- Novelty score: ${input.dedupe.noveltyScore.toFixed(2)}`,
    input.classification.classification ? `- Classification: ${input.classification.classification}` : null,
    input.classification.topic ? `- Topic: ${input.classification.topic}` : null,
    "",
    excerpt ? "## Source excerpt" : null,
    "",
    excerpt ?? null,
    "",
    input.item.canonicalUrl ? `[Original source](${input.item.canonicalUrl})` : null,
  ].filter((line): line is string => line !== null);

  return {
    bodyMd: bodyLines.join("\n"),
    highlights,
    metadata: {
      preservation: {
        createdFrom: "processed_item",
        importanceScore: input.score.importanceScore,
        noveltyScore: input.dedupe.noveltyScore,
        pipelineVersion: "v1",
        rule: "importance-novelty-threshold",
      },
    },
    noteType,
    reviewWeight,
    tags: input.classification.tags,
    title,
  };
}

function buildExcerpt(contentText: string | null) {
  const content = firstNonEmpty(contentText);

  if (!content) {
    return null;
  }

  const excerpt = splitSentences(content).slice(0, 2).join(" ");
  const normalizedExcerpt = normalizeWhitespace(excerpt || content);

  if (normalizedExcerpt.length <= 320) {
    return normalizedExcerpt;
  }

  return `${normalizedExcerpt.slice(0, 319).trimEnd()}…`;
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  const result: string[] = [];

  for (const value of values) {
    const normalized = value ? normalizeWhitespace(value) : null;

    if (!normalized || result.includes(normalized)) {
      continue;
    }

    result.push(normalized);
  }

  return result;
}
