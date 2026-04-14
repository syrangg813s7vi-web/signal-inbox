import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import {
  captureEntries,
  createDbFromClient,
  createSqlClient,
  enrichments,
  inboxSelections,
  itemGroupMembers,
  itemGroups,
  items,
  rawAssets,
  sources,
} from "@signal-inbox/db";

type DatabaseTransaction = Parameters<
  Parameters<ReturnType<typeof createDbFromClient>["transaction"]>[0]
>[0];

const INBOX_SELECTION_POLICY_VERSION = "v1";
const INBOX_SELECTION_BUDGET = 12;
const INBOX_SELECTION_CANDIDATE_LIMIT = 48;
const INBOX_SELECTION_MAX_PER_TOPIC = 2;
const INBOX_SELECTION_MAX_PER_SOURCE = 4;

export interface InboxCandidate {
  classification: string | null;
  contentText: string | null;
  duplicateOfItemId: string | null;
  id: string;
  importanceScore: number | null;
  metadata: Record<string, unknown>;
  noveltyScore: number | null;
  preserveRecommendation: "discard" | "keep" | "review" | null;
  publishedAt: Date | null;
  sourceName: string | null;
  summaryLong: string | null;
  summaryShort: string | null;
  tags: string[];
  title: string | null;
  topic: string | null;
  topicGroupTitle: string | null;
  url: string | null;
  whyItMatters: string | null;
}

export interface InboxSelectionScoreBreakdown {
  importanceScore: number;
  noveltyScore: number;
  qualityAdjustment: number;
  totalScore: number;
}

export interface InboxSelectionDecision {
  itemId: string;
  metadata: Record<string, unknown>;
  policyVersion: string;
  relevanceScore: number;
  scoreBreakdown: InboxSelectionScoreBreakdown;
  selected: boolean;
  selectionReasons: string[];
}

export interface RefreshInboxSelectionsResult {
  candidateCount: number;
  policyVersion: string;
  selectedCount: number;
}

export interface SelectedInboxItem {
  canonicalUrl: string | null;
  classification: string | null;
  contentText: string | null;
  duplicateOfItemId: string | null;
  id: string;
  importanceScore: number | null;
  noveltyScore: number | null;
  publishedAt: Date | null;
  scoreBreakdown: InboxSelectionScoreBreakdown;
  selectionMetadata: Record<string, unknown>;
  selectionPolicyVersion: string;
  selectionReasons: string[];
  selectionScore: number;
  sourceName: string | null;
  sourceTopic: string | null;
  sourceType: "rss" | null;
  summaryLong: string | null;
  summaryShort: string | null;
  tags: string[];
  title: string | null;
  topic: string | null;
  topicGroupTitle: string | null;
}

interface CandidateRow {
  canonicalUrl: string | null;
  classification: string | null;
  contentText: string | null;
  id: string;
  importanceScore: number | null;
  metadata: Record<string, unknown>;
  noveltyScore: number | null;
  preserveRecommendation: "discard" | "keep" | "review" | null;
  publishedAt: Date | null;
  sourceName: string | null;
  summaryLong: string | null;
  sourceTopic: string | null;
  sourceType: "rss" | null;
  summaryShort: string | null;
  tags: string[] | null;
  title: string | null;
  topic: string | null;
  topicGroupTitle: string | null;
  whyItMatters: string | null;
}

interface SelectedInboxRow extends CandidateRow {
  relevanceScore: number;
  scoreBreakdown: InboxSelectionScoreBreakdown;
  selectionMetadata: Record<string, unknown>;
  selectionPolicyVersion: string;
  selectionReasons: string[] | null;
}

export async function refreshInboxSelections(
  databaseUrl = process.env.DATABASE_URL,
): Promise<RefreshInboxSelectionsResult> {
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);

  try {
    return await db.transaction(async (tx) => {
      const candidates = await loadInboxCandidates(tx);
      const decisions = selectInboxCandidates(candidates);
      const updatedAt = new Date();

      await tx
        .update(inboxSelections)
        .set({
          isCurrent: false,
          updatedAt,
        })
        .where(eq(inboxSelections.isCurrent, true));

      if (decisions.length > 0) {
        await tx.insert(inboxSelections).values(
          decisions.map((decision) => ({
            itemId: decision.itemId,
            metadata: decision.metadata,
            policyVersion: decision.policyVersion,
            relevanceScore: decision.relevanceScore,
            scoreBreakdown: toScoreBreakdownRecord(decision.scoreBreakdown),
            selected: decision.selected,
            selectionReasons: decision.selectionReasons,
            updatedAt,
          })),
        );
      }

      return {
        candidateCount: candidates.length,
        policyVersion: INBOX_SELECTION_POLICY_VERSION,
        selectedCount: decisions.filter((decision) => decision.selected).length,
      };
    });
  } finally {
    await client.end();
  }
}

export async function listSelectedInboxItems(
  databaseUrl = process.env.DATABASE_URL,
): Promise<SelectedInboxItem[]> {
  const client = createSqlClient(databaseUrl);
  const db = createDbFromClient(client);
  const topicGroupTitles = buildTopicGroupTitlesQuery(db);

  try {
    const rows = await db
      .select({
        canonicalUrl: items.canonicalUrl,
        classification: enrichments.classification,
        contentText: items.contentText,
        id: items.id,
        importanceScore: enrichments.importanceScore,
        metadata: items.metadata,
        noveltyScore: enrichments.noveltyScore,
        publishedAt: items.publishedAt,
        relevanceScore: inboxSelections.relevanceScore,
        scoreBreakdown: inboxSelections.scoreBreakdown,
        selectionMetadata: inboxSelections.metadata,
        selectionPolicyVersion: inboxSelections.policyVersion,
        selectionReasons: inboxSelections.selectionReasons,
        sourceName: sources.name,
        sourceTopic: sources.topic,
        sourceType: sources.sourceType,
        summaryLong: enrichments.summaryLong,
        summaryShort: enrichments.summaryShort,
        tags: enrichments.tags,
        title: items.title,
        topic: enrichments.topic,
        topicGroupTitle: topicGroupTitles.topicGroupTitle,
        whyItMatters: enrichments.whyItMatters,
      })
      .from(inboxSelections)
      .innerJoin(items, eq(items.id, inboxSelections.itemId))
      .innerJoin(
        enrichments,
        and(eq(enrichments.itemId, items.id), eq(enrichments.isCurrent, true)),
      )
      .leftJoin(rawAssets, eq(rawAssets.id, items.rawAssetId))
      .leftJoin(captureEntries, eq(captureEntries.id, rawAssets.captureEntryId))
      .leftJoin(sources, eq(sources.id, captureEntries.sourceId))
      .leftJoin(topicGroupTitles, eq(topicGroupTitles.itemId, items.id))
      .where(and(eq(inboxSelections.isCurrent, true), eq(inboxSelections.selected, true)))
      .orderBy(desc(inboxSelections.relevanceScore), desc(items.publishedAt), desc(items.createdAt));

    return rows.map((row) => ({
      canonicalUrl: row.canonicalUrl,
      classification: row.classification,
      contentText: row.contentText,
      duplicateOfItemId: extractDuplicateOfItemId(row.metadata),
      id: row.id,
      importanceScore: row.importanceScore,
      noveltyScore: row.noveltyScore,
      publishedAt: row.publishedAt,
      scoreBreakdown: normalizeScoreBreakdown(row.scoreBreakdown, row.relevanceScore),
      selectionMetadata: row.selectionMetadata ?? {},
      selectionPolicyVersion: row.selectionPolicyVersion,
      selectionReasons: row.selectionReasons ?? [],
      selectionScore: row.relevanceScore,
      sourceName: row.sourceName?.trim() || null,
      sourceTopic: row.sourceTopic?.trim() || null,
      sourceType: row.sourceType,
      summaryLong: row.summaryLong,
      summaryShort: row.summaryShort,
      tags: row.tags ?? [],
      title: row.title,
      topic: row.topic,
      topicGroupTitle: row.topicGroupTitle,
    }));
  } finally {
    await client.end();
  }
}

async function loadInboxCandidates(tx: DatabaseTransaction): Promise<InboxCandidate[]> {
  const topicGroupTitles = buildTopicGroupTitlesQuery(tx);
  const rows = await tx
    .select({
      canonicalUrl: items.canonicalUrl,
      classification: enrichments.classification,
      contentText: items.contentText,
      id: items.id,
      importanceScore: enrichments.importanceScore,
      metadata: items.metadata,
      noveltyScore: enrichments.noveltyScore,
      preserveRecommendation: enrichments.preserveRecommendation,
      publishedAt: items.publishedAt,
      sourceName: sources.name,
      sourceTopic: sources.topic,
      sourceType: sources.sourceType,
      summaryLong: enrichments.summaryLong,
      summaryShort: enrichments.summaryShort,
      tags: enrichments.tags,
      title: items.title,
      topic: enrichments.topic,
      topicGroupTitle: topicGroupTitles.topicGroupTitle,
      whyItMatters: enrichments.whyItMatters,
    })
    .from(items)
    .innerJoin(
      enrichments,
      and(eq(enrichments.itemId, items.id), eq(enrichments.isCurrent, true)),
    )
    .leftJoin(rawAssets, eq(rawAssets.id, items.rawAssetId))
    .leftJoin(captureEntries, eq(captureEntries.id, rawAssets.captureEntryId))
    .leftJoin(sources, eq(sources.id, captureEntries.sourceId))
    .leftJoin(topicGroupTitles, eq(topicGroupTitles.itemId, items.id))
    .where(
      and(
        eq(items.status, "processed"),
        eq(enrichments.isCurrent, true),
        isNotNull(enrichments.itemId),
      ),
    )
    .orderBy(desc(enrichments.importanceScore), desc(items.publishedAt), desc(items.createdAt))
    .limit(INBOX_SELECTION_CANDIDATE_LIMIT);

  return rows.map((row) => mapCandidateRow(row));
}

function buildTopicGroupTitlesQuery(db: DatabaseTransaction | ReturnType<typeof createDbFromClient>) {
  return db
    .select({
      itemId: itemGroupMembers.itemId,
      topicGroupTitle: sql<string | null>`
        case
          when count(*) = 1 then min(${itemGroups.title})
          else null
        end
      `.as("topicGroupTitle"),
    })
    .from(itemGroupMembers)
    .innerJoin(
      itemGroups,
      and(eq(itemGroups.id, itemGroupMembers.groupId), eq(itemGroups.groupType, "topic")),
    )
    .groupBy(itemGroupMembers.itemId)
    .as("topic_group_titles");
}

function mapCandidateRow(row: CandidateRow): InboxCandidate {
  return {
    classification: row.classification,
    contentText: row.contentText,
    duplicateOfItemId: extractDuplicateOfItemId(row.metadata),
    id: row.id,
    importanceScore: row.importanceScore,
    metadata: row.metadata,
    noveltyScore: row.noveltyScore,
    preserveRecommendation: row.preserveRecommendation,
    publishedAt: row.publishedAt,
    sourceName: row.sourceName?.trim() || null,
    summaryLong: row.summaryLong,
    summaryShort: row.summaryShort,
    tags: row.tags ?? [],
    title: row.title,
    topic: row.topic,
    topicGroupTitle: row.topicGroupTitle,
    url: row.canonicalUrl,
    whyItMatters: row.whyItMatters,
  };
}

function selectInboxCandidates(candidates: InboxCandidate[]): InboxSelectionDecision[] {
  const decisionsByItemId = new Map<string, InboxSelectionDecision>();
  const scoredCandidates: Array<{
    candidate: InboxCandidate;
    reasons: string[];
    scoreBreakdown: InboxSelectionScoreBreakdown;
    topicKey: string;
    sourceKey: string;
  }> = [];

  for (const candidate of candidates) {
    const hardFilterReasons = getHardFilterReasons(candidate);
    const scoreBreakdown = scoreCandidate(candidate);

    if (hardFilterReasons.length > 0) {
      decisionsByItemId.set(
        candidate.id,
        buildDecision({
          candidate,
          reasons: hardFilterReasons,
          scoreBreakdown,
          selected: false,
          stage: "hard_filter",
        }),
      );
      continue;
    }

    scoredCandidates.push({
      candidate,
      reasons: getSelectionReasons(candidate, scoreBreakdown),
      scoreBreakdown,
      sourceKey: normalizeBucketKey(candidate.sourceName, "unknown-source"),
      topicKey: normalizeBucketKey(
        candidate.topicGroupTitle ?? candidate.topic ?? candidate.classification,
        "unknown-topic",
      ),
    });
  }

  scoredCandidates.sort((left, right) => {
    if (right.scoreBreakdown.totalScore !== left.scoreBreakdown.totalScore) {
      return right.scoreBreakdown.totalScore - left.scoreBreakdown.totalScore;
    }

    return (right.candidate.publishedAt?.getTime() ?? 0) - (left.candidate.publishedAt?.getTime() ?? 0);
  });

  const topicCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  let selectedCount = 0;

  for (const entry of scoredCandidates) {
    const topicCount = topicCounts.get(entry.topicKey) ?? 0;
    const sourceCount = sourceCounts.get(entry.sourceKey) ?? 0;

    if (selectedCount >= INBOX_SELECTION_BUDGET) {
      decisionsByItemId.set(
        entry.candidate.id,
        buildDecision({
          candidate: entry.candidate,
          reasons: ["selection_budget_reached"],
          scoreBreakdown: entry.scoreBreakdown,
          selected: false,
          stage: "budget",
        }),
      );
      continue;
    }

    if (topicCount >= INBOX_SELECTION_MAX_PER_TOPIC) {
      decisionsByItemId.set(
        entry.candidate.id,
        buildDecision({
          candidate: entry.candidate,
          reasons: ["topic_diversity_limit"],
          scoreBreakdown: entry.scoreBreakdown,
          selected: false,
          stage: "diversity",
        }),
      );
      continue;
    }

    if (sourceCount >= INBOX_SELECTION_MAX_PER_SOURCE) {
      decisionsByItemId.set(
        entry.candidate.id,
        buildDecision({
          candidate: entry.candidate,
          reasons: ["source_diversity_limit"],
          scoreBreakdown: entry.scoreBreakdown,
          selected: false,
          stage: "diversity",
        }),
      );
      continue;
    }

    selectedCount += 1;
    topicCounts.set(entry.topicKey, topicCount + 1);
    sourceCounts.set(entry.sourceKey, sourceCount + 1);
    decisionsByItemId.set(
      entry.candidate.id,
      buildDecision({
        candidate: entry.candidate,
        reasons: [
          ...entry.reasons,
          `topic_slot_${topicCount + 1}`,
          `source_slot_${sourceCount + 1}`,
          `selection_rank_${selectedCount}`,
        ],
        scoreBreakdown: entry.scoreBreakdown,
        selected: true,
        stage: "selected",
      }),
    );
  }

  return candidates
    .map((candidate) => decisionsByItemId.get(candidate.id))
    .filter((decision): decision is InboxSelectionDecision => Boolean(decision));
}

function getHardFilterReasons(candidate: InboxCandidate) {
  const reasons: string[] = [];
  const title = normalizeWhitespace(candidate.title ?? "");
  const summary = normalizeWhitespace(candidate.summaryShort ?? candidate.summaryLong ?? "");
  const content = normalizeWhitespace(candidate.contentText ?? "");
  const importanceScore = candidate.importanceScore ?? 0;
  const noveltyScore = candidate.noveltyScore ?? 0;

  if (candidate.duplicateOfItemId) {
    reasons.push("duplicate_item");
  }

  if (candidate.preserveRecommendation === "discard") {
    reasons.push("discarded_by_enrichment");
  }

  if (!title) {
    reasons.push("missing_title");
  }

  if (!summary && content.length < 160) {
    reasons.push("incomplete_content");
  }

  if (candidate.importanceScore === null || candidate.noveltyScore === null) {
    reasons.push("missing_signal_scores");
  }

  if (importanceScore < 0.35 && noveltyScore < 0.35) {
    reasons.push("low_signal_scores");
  }

  return reasons;
}

function scoreCandidate(candidate: InboxCandidate): InboxSelectionScoreBreakdown {
  const importanceScore = clampScore(candidate.importanceScore ?? 0);
  const noveltyScore = clampScore(candidate.noveltyScore ?? 0);
  let qualityAdjustment = 0;
  const title = normalizeWhitespace(candidate.title ?? "").toLowerCase();
  const summary = normalizeWhitespace(candidate.summaryShort ?? candidate.summaryLong ?? "");

  if (summary) {
    qualityAdjustment += 0.03;
  }

  if (candidate.whyItMatters?.trim()) {
    qualityAdjustment += 0.05;
  }

  if (candidate.topicGroupTitle?.trim()) {
    qualityAdjustment += 0.03;
  }

  if (/(roundup|linkdump|daily digest|weekly digest|briefing)/i.test(title)) {
    qualityAdjustment -= 0.08;
  }

  if (summary && title && summary.toLowerCase() === title) {
    qualityAdjustment -= 0.04;
  }

  return {
    importanceScore,
    noveltyScore,
    qualityAdjustment: roundScore(qualityAdjustment),
    totalScore: roundScore(importanceScore * 0.65 + noveltyScore * 0.35 + qualityAdjustment),
  };
}

function getSelectionReasons(
  candidate: InboxCandidate,
  scoreBreakdown: InboxSelectionScoreBreakdown,
) {
  const reasons: string[] = [];

  if (scoreBreakdown.importanceScore >= 0.7) {
    reasons.push("high_importance");
  }

  if (scoreBreakdown.noveltyScore >= 0.6) {
    reasons.push("high_novelty");
  }

  if (scoreBreakdown.qualityAdjustment > 0) {
    reasons.push("quality_adjusted");
  }

  if (candidate.topicGroupTitle?.trim()) {
    reasons.push("topic_grouped");
  }

  if (candidate.sourceName?.trim()) {
    reasons.push("source_attributed");
  }

  return reasons.length > 0 ? reasons : ["ranked_for_relevance"];
}

function buildDecision(input: {
  candidate: InboxCandidate;
  reasons: string[];
  scoreBreakdown: InboxSelectionScoreBreakdown;
  selected: boolean;
  stage: "budget" | "diversity" | "hard_filter" | "selected";
}) {
  return {
    itemId: input.candidate.id,
    metadata: {
      candidateWindow: INBOX_SELECTION_CANDIDATE_LIMIT,
      duplicateOfItemId: input.candidate.duplicateOfItemId,
      importanceScore: input.scoreBreakdown.importanceScore,
      noveltyScore: input.scoreBreakdown.noveltyScore,
      policyStage: input.stage,
      qualityAdjustment: input.scoreBreakdown.qualityAdjustment,
      sourceName: input.candidate.sourceName,
      topicGroupTitle: input.candidate.topicGroupTitle,
    },
    policyVersion: INBOX_SELECTION_POLICY_VERSION,
    relevanceScore: input.scoreBreakdown.totalScore,
    scoreBreakdown: input.scoreBreakdown,
    selected: input.selected,
    selectionReasons: input.reasons,
  } satisfies InboxSelectionDecision;
}

function extractDuplicateOfItemId(metadata: Record<string, unknown>) {
  const knowledgeProcessing = metadata.knowledgeProcessing;

  if (!knowledgeProcessing || typeof knowledgeProcessing !== "object" || Array.isArray(knowledgeProcessing)) {
    return null;
  }

  const knowledgeProcessingRecord = knowledgeProcessing as Record<string, unknown>;
  const duplicateOfItemId = knowledgeProcessingRecord.duplicateOfItemId;

  return typeof duplicateOfItemId === "string" ? duplicateOfItemId : null;
}

function normalizeScoreBreakdown(
  value: Record<string, unknown> | null,
  relevanceScore: number,
): InboxSelectionScoreBreakdown {
  const scoreBreakdown = value ?? {};

  return {
    importanceScore: getNumericValue(scoreBreakdown.importanceScore),
    noveltyScore: getNumericValue(scoreBreakdown.noveltyScore),
    qualityAdjustment: getNumericValue(scoreBreakdown.qualityAdjustment),
    totalScore: getNumericValue(scoreBreakdown.totalScore, relevanceScore),
  };
}

function getNumericValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toScoreBreakdownRecord(scoreBreakdown: InboxSelectionScoreBreakdown): Record<string, number> {
  return {
    importanceScore: scoreBreakdown.importanceScore,
    noveltyScore: scoreBreakdown.noveltyScore,
    qualityAdjustment: scoreBreakdown.qualityAdjustment,
    totalScore: scoreBreakdown.totalScore,
  };
}

function normalizeBucketKey(value: string | null | undefined, fallback: string) {
  const normalized = normalizeWhitespace(value ?? "").toLowerCase();

  return normalized || fallback;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, roundScore(value)));
}

function roundScore(value: number) {
  return Math.round(value * 1000) / 1000;
}
