import type { BuiltNoteResult, NoteBuildInput } from "./types";
import { clampScore, firstNonEmpty, normalizeWhitespace, splitSentences } from "./utils";

export function buildNoteIfPreservationWorthy(input: NoteBuildInput): BuiltNoteResult | null {
  if (input.dedupe.duplicateOfItemId) {
    return null;
  }

  if (input.enrichment.preserveRecommendation !== "keep") {
    return null;
  }

  const title =
    firstNonEmpty(input.item.title, input.enrichment.summary.short, input.enrichment.classification.topic) ??
    "Preserved note";
  const excerpt = buildExcerpt(input.item.contentText);
  const highlights = uniqueNonEmpty([
    input.enrichment.summary.short,
    input.enrichment.whyItMatters,
    ...input.enrichment.keyPoints,
    excerpt,
    input.enrichment.classification.topic,
  ]).slice(0, 4);
  const noteType =
    input.enrichment.classification.label === "research" ||
    input.enrichment.classification.label === "tutorial"
      ? "summary"
      : "reference";
  const reviewWeight = clampScore(
    (input.enrichment.importanceScore + input.enrichment.noveltyScore) / 2,
  );
  const bodyMd = input.enrichment.noteDraft
    ? prefixTitleIfMissing(input.enrichment.noteDraft, title)
    : buildFallbackNoteBody(input, title, excerpt);

  return {
    bodyMd,
    highlights,
    metadata: {
      preservation: {
        createdFrom: "processed_item",
        importanceScore: input.enrichment.importanceScore,
        noveltyScore: input.enrichment.noveltyScore,
        pipelineVersion: "v1",
        recommendation: input.enrichment.preserveRecommendation,
        rule: "model-backed-preserve-recommendation",
      },
    },
    noteType,
    reviewWeight,
    tags: input.enrichment.tags,
    title,
  };
}

function buildFallbackNoteBody(input: NoteBuildInput, title: string, excerpt: string | null) {
  const bodyLines = [
    `# ${title}`,
    "",
    input.enrichment.summary.short,
    "",
    input.enrichment.summary.long ? "## Summary" : null,
    input.enrichment.summary.long ?? null,
    "",
    "## Why it matters",
    "",
    input.enrichment.whyItMatters,
    "",
    "## Key points",
    "",
    ...input.enrichment.keyPoints.map((point) => `- ${point}`),
    "",
    "## Preservation context",
    "",
    `- Importance score: ${input.enrichment.importanceScore.toFixed(2)}`,
    `- Novelty score: ${input.enrichment.noveltyScore.toFixed(2)}`,
    `- Baseline score heuristic: ${input.score.importanceScore.toFixed(2)}`,
    `- Deduped as duplicate: ${input.dedupe.duplicateOfItemId ? "yes" : "no"}`,
    input.enrichment.classification.label
      ? `- Classification: ${input.enrichment.classification.label}`
      : null,
    input.enrichment.classification.topic ? `- Topic: ${input.enrichment.classification.topic}` : null,
    "",
    excerpt ? "## Source excerpt" : null,
    excerpt ? "" : null,
    excerpt ?? null,
    "",
    input.item.canonicalUrl ? `[Original source](${input.item.canonicalUrl})` : null,
  ].filter((line): line is string => line !== null);

  return bodyLines.join("\n");
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

function prefixTitleIfMissing(noteDraft: string, title: string) {
  const normalizedNoteDraft = noteDraft.trim();

  if (!normalizedNoteDraft) {
    return `# ${title}`;
  }

  return normalizedNoteDraft.startsWith("# ") ? normalizedNoteDraft : `# ${title}\n\n${normalizedNoteDraft}`;
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
