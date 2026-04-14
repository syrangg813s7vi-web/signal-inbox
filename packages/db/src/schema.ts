import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import {
  index,
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const emptyJsonb = sql`'{}'::jsonb`;

export const sourceTypeEnum = pgEnum("source_type", ["rss"]);
export const sourceStatusEnum = pgEnum("source_status", ["active", "paused", "error"]);

export const captureEntryTypeEnum = pgEnum("capture_entry_type", [
  "source_sync",
  "manual_link",
  "url_submission",
]);
export const captureEntryStatusEnum = pgEnum("capture_entry_status", [
  "captured",
  "normalized",
  "failed",
]);

export const rawAssetTypeEnum = pgEnum("raw_asset_type", ["url", "article"]);
export const rawAssetStatusEnum = pgEnum("raw_asset_status", ["new", "normalized", "failed"]);

export const itemTypeEnum = pgEnum("item_type", ["article"]);
export const itemStatusEnum = pgEnum("item_status", ["new", "processed", "archived"]);
export const preserveRecommendationEnum = pgEnum("preserve_recommendation", [
  "keep",
  "discard",
  "review",
]);

export const itemGroupTypeEnum = pgEnum("item_group_type", ["topic"]);
export const noteTypeEnum = pgEnum("note_type", ["reference", "summary"]);
export const knowledgeDestinationTypeEnum = pgEnum("knowledge_destination_type", [
  "notion",
  "obsidian",
]);
export const knowledgeDestinationStatusEnum = pgEnum("knowledge_destination_status", [
  "active",
  "disabled",
  "error",
]);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").$defaultFn(randomUUID).primaryKey(),
    name: text("name").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    sourceRef: text("source_ref").notNull(),
    sourceUrl: text("source_url"),
    status: sourceStatusEnum("status").notNull().default("active"),
    topic: text("topic"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(emptyJsonb),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sources_source_type_source_ref_key").on(table.sourceType, table.sourceRef),
    index("sources_status_idx").on(table.status),
    index("sources_topic_idx").on(table.topic),
  ],
);

export const sourceSyncState = pgTable("source_sync_state", {
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" })
    .primaryKey(),
  cursor: text("cursor"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: "date" }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true, mode: "date" }),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true, mode: "date" }),
  lastErrorMessage: text("last_error_message"),
});

export const captureEntries = pgTable(
  "capture_entries",
  {
    id: uuid("id").$defaultFn(randomUUID).primaryKey(),
    entryType: captureEntryTypeEnum("entry_type").notNull(),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    triggerRef: text("trigger_ref"),
    status: captureEntryStatusEnum("status").notNull().default("captured"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(emptyJsonb),
    capturedAt: timestamp("captured_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("capture_entries_source_id_idx").on(table.sourceId),
    index("capture_entries_status_idx").on(table.status),
    index("capture_entries_captured_at_idx").on(table.capturedAt),
  ],
);

export const rawAssets = pgTable(
  "raw_assets",
  {
    id: uuid("id").$defaultFn(randomUUID).primaryKey(),
    captureEntryId: uuid("capture_entry_id")
      .notNull()
      .references(() => captureEntries.id, { onDelete: "cascade" }),
    assetType: rawAssetTypeEnum("asset_type").notNull(),
    externalId: text("external_id"),
    title: text("title"),
    author: text("author"),
    url: text("url"),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    rawContent: text("raw_content"),
    rawMetadata: jsonb("raw_metadata").$type<Record<string, unknown>>().notNull().default(emptyJsonb),
    status: rawAssetStatusEnum("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("raw_assets_capture_entry_id_idx").on(table.captureEntryId),
    index("raw_assets_status_idx").on(table.status),
    index("raw_assets_url_idx").on(table.url),
    index("raw_assets_published_at_idx").on(table.publishedAt),
  ],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").$defaultFn(randomUUID).primaryKey(),
    rawAssetId: uuid("raw_asset_id")
      .notNull()
      .references(() => rawAssets.id, { onDelete: "cascade" }),
    itemType: itemTypeEnum("item_type").notNull(),
    title: text("title"),
    canonicalUrl: text("canonical_url"),
    author: text("author"),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    language: text("language"),
    contentText: text("content_text"),
    status: itemStatusEnum("status").notNull().default("new"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(emptyJsonb),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("items_raw_asset_id_key").on(table.rawAssetId),
    uniqueIndex("items_canonical_url_key")
      .on(table.canonicalUrl)
      .where(sql`${table.canonicalUrl} is not null`),
    index("items_status_idx").on(table.status),
    index("items_published_at_idx").on(table.publishedAt),
  ],
);

export const enrichments = pgTable(
  "enrichments",
  {
    id: uuid("id").$defaultFn(randomUUID).primaryKey(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    importanceScore: real("importance_score"),
    noveltyScore: real("novelty_score"),
    summaryShort: text("summary_short"),
    summaryLong: text("summary_long"),
    keyPoints: text("key_points").array(),
    tags: text("tags").array(),
    topic: text("topic"),
    classification: text("classification"),
    whyItMatters: text("why_it_matters"),
    preserveRecommendation: preserveRecommendationEnum("preserve_recommendation"),
    noteDraft: text("note_draft"),
    aiCommentary: text("ai_commentary"),
    dedupeKey: text("dedupe_key"),
    isCurrent: boolean("is_current").notNull().default(true),
    supersededAt: timestamp("superseded_at", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(emptyJsonb),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("enrichments_current_item_id_key")
      .on(table.itemId)
      .where(sql`${table.isCurrent} is true`),
    index("enrichments_dedupe_key_idx").on(table.dedupeKey),
    index("enrichments_topic_idx").on(table.topic),
  ],
);

export const itemGroups = pgTable(
  "item_groups",
  {
    id: uuid("id").$defaultFn(randomUUID).primaryKey(),
    groupType: itemGroupTypeEnum("group_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    tag: text("tag"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("item_groups_group_type_idx").on(table.groupType),
    index("item_groups_tag_idx").on(table.tag),
    uniqueIndex("item_groups_group_type_tag_key").on(table.groupType, table.tag),
  ],
);

export const itemGroupMembers = pgTable(
  "item_group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => itemGroups.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.itemId], name: "item_group_members_pkey" }),
    index("item_group_members_item_id_idx").on(table.itemId),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").$defaultFn(randomUUID).primaryKey(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    noteType: noteTypeEnum("note_type").notNull(),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    highlights: text("highlights").array().notNull().default(sql`'{}'::text[]`),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    reviewWeight: real("review_weight"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(emptyJsonb),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("notes_item_id_key").on(table.itemId),
    index("notes_note_type_idx").on(table.noteType),
    index("notes_created_at_idx").on(table.createdAt),
  ],
);

export const knowledgeDestinations = pgTable(
  "knowledge_destinations",
  {
    id: uuid("id").$defaultFn(randomUUID).primaryKey(),
    destinationType: knowledgeDestinationTypeEnum("destination_type").notNull(),
    name: text("name").notNull(),
    targetRef: text("target_ref").notNull(),
    status: knowledgeDestinationStatusEnum("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(emptyJsonb),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("knowledge_destinations_type_target_ref_key").on(
      table.destinationType,
      table.targetRef,
    ),
    index("knowledge_destinations_status_idx").on(table.status),
  ],
);
