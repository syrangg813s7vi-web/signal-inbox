# Data Model

## Core Domain Objects

The data model follows the three product domains and four implementation layers.

### Capture Domain

- `Source`
- `SourceSyncState`
- `CaptureEntry`
- `RawAsset`

### Knowledge Domain

- `Item`
- `Enrichment`
- `ItemGroup`
- `Note`
- `KnowledgeDestination`

### Review Domain

- `Digest`
- `ReviewObject`

### Supporting Objects

- `DeliveryDestination`
- `DeliveryLog`

These names should remain stable across docs, code, and UI-facing implementation details where appropriate.

## Tables

### sources

Purpose:

Store configured recurring capture sources.

Fields:

- `id`
- `name`
- `source_type`
- `source_ref`
- `source_url`
- `status`
- `topic`
- `metadata`
- `created_at`
- `updated_at`

Constraints:

- unique by `source_type + source_ref`

States:

- `active`
- `paused`
- `error`

V1 source types:

- `rss`
- `submitted_url`

Future source types:

- `twitter_list`
- `wechat`
- `youtube`
- `podcast`

### source_sync_state

Purpose:

Store the latest sync position and sync health for each source.

Initialization:

- create one `SourceSyncState` row when a recurring `Source` is created so later sync tracking has a stable record from day one

Fields:

- `source_id`
- `cursor`
- `last_synced_at`
- `last_success_at`
- `last_error_at`
- `last_error_message`

Constraints:

- one row per source

### capture_entries

Purpose:

Store user- or system-initiated capture events before or during raw asset creation.

Fields:

- `id`
- `entry_type`
- `source_id`
- `trigger_ref`
- `status`
- `metadata`
- `captured_at`
- `created_at`

V1 entry types:

- `source_sync`
- `manual_link`
- `url_submission`

States:

- `captured`
- `normalized`
- `failed`

### raw_assets

Purpose:

Store original captured material before normalization.

Fields:

- `id`
- `capture_entry_id`
- `asset_type`
- `external_id`
- `title`
- `author`
- `url`
- `published_at`
- `raw_content`
- `raw_metadata`
- `status`
- `created_at`
- `updated_at`

V1 asset types:

- `url`
- `article`
- `video`
- `raw_html`

Future asset types:

- `tweet`
- `video`
- `audio`
- `image`
- `file`
- `message`

States:

- `new`
- `normalized`
- `failed`

URL-ingest metadata guidance:

- for first-pass URL submission, `raw_assets.raw_metadata` should preserve enough fetch and extraction context to explain the capture result, including when available:
  - `submittedUrl`
  - `finalUrl`
  - `httpStatus`
  - `fetchTimestamp`
  - `extractor`
  - `extractorVersion`
  - `extractionStatus`
  - `contentType`
  - `redirectCount`

### items

Purpose:

Store normalized information objects after extraction and normalization.

Fields:

- `id`
- `raw_asset_id`
- `item_type`
- `title`
- `canonical_url`
- `author`
- `published_at`
- `language`
- `content_text`
- `status`
- `metadata`
- `created_at`
- `updated_at`

V1 normalization metadata should retain enough source context for downstream processing, including extraction details and connector identity, without embedding summaries, scores, or ranking output.
When a normalized `Item` would collide with an existing `canonical_url`, V1 may preserve the conflicting URL in `metadata.canonicalUrlConflict` and leave `canonical_url` null so normalization can still produce a stable shared `Item`.

Constraints:

- unique by `canonical_url` when present

States:

- `new`
- `processed`
- `archived`

V1 item types:

- `article`
- `video`

Future item types:

- `tweet`
- `audio`
- `note_candidate`

Video-item metadata guidance:

- video links should normalize into the shared `Item` model with `item_type = video`
- the first-slice representation should preserve video-specific metadata in `items.metadata.video`
- the normalized `items.metadata.video` object should retain, when available:
  - `platform`
  - `creatorName`
  - `creatorUrl`
  - `durationSeconds`
  - `durationLabel`
  - `thumbnailUrl`
  - `targetUrl`
  - `embedUrl`
  - `description`
- video items may synthesize `content_text` from stable metadata when transcript-like text is unavailable so the shared Knowledge and Review pipeline can still operate without a special bypass

### enrichments

Purpose:

Store AI and rule-based processing results for Items.

Fields:

- `id`
- `item_id`
- `importance_score`
- `novelty_score`
- `summary_short`
- `summary_long`
- `key_points`
- `tags`
- `topic`
- `classification`
- `why_it_matters`
- `preserve_recommendation`
- `note_draft`
- `ai_commentary`
- `dedupe_key`
- `is_current`
- `superseded_at`
- `metadata`
- `created_at`
- `updated_at`

Constraints:

- one current enrichment record per item is required for product reads
- older successful enrichment rows may remain as history when an item is reprocessed

V1 enrichment shape:

- `summary_short`
  - short AI-generated Inbox summary used for quick review
  - must not degrade into `Title: first sentence` or a title-only label
- `summary_long`
  - longer preservation-oriented summary when needed
- `key_points`
  - 3 to 5 core takeaways from the normalized Item
- `classification`
  - primary type or topic class for routing and display
- `tags`
  - secondary labels for filtering and review
- `importance_score`
  - normalized score for ranking importance
- `novelty_score`
  - normalized score for ranking freshness or distinctiveness
- `why_it_matters`
  - concise explanation of why the Item deserves attention
- `preserve_recommendation`
  - one of:
    - `keep`
    - `discard`
    - `review`
- `note_draft`
  - optional draft body for later `Note` creation

Usage rule:

- the enrichment record is the structured AI output contract for downstream product surfaces
- product surfaces should read the current enrichment row for an item, not an arbitrary historical row
- `Inbox` should consume summary, key points, classification, tags, scores, and why-it-matters reasoning
- `Knowledge` should additionally consume preserve recommendation and note draft
- `Knowledge` preservation flows may also consume `items.metadata.video` so downstream notes and sinks can retain video-specific context without bypassing the shared `Item -> Enrichment -> Note` path
- `Review` should consume processed summaries, key points, classifications, and scores rather than raw source material
- `metadata.generation` should retain the provider, model, prompt version, and key generation settings used to produce the row

### item_groups

Purpose:

Store grouped topic views for Inbox and later review surfaces.

Fields:

- `id`
- `group_type`
- `title`
- `summary`
- `tag`
- `created_at`
- `updated_at`

V1 group type:

- `topic`

Constraints:

- one stable group per `group_type + tag` in V1

### item_group_members

Purpose:

Map Items into ItemGroups.

Fields:

- `group_id`
- `item_id`

Constraints:

- unique pair of `group_id + item_id`

### inbox_candidates

Purpose:

Represent the normalized, enrichment-backed fields that Inbox selection logic operates on.

Design note:

- this is a conceptual model boundary, not necessarily a dedicated persisted table in V1
- the candidate shape should remain stable even if the underlying `items` or `enrichments` schema grows

Minimum fields:

- `item_id`
- `title`
- `summary_short`
- `importance_score`
- `novelty_score`
- `classification`
- `topic`
- `topic_group_title`
- `source_name`
- `duplicate_of_item_id`
- `published_at`
- `metadata`

Rule:

- Inbox filters and scorers should operate on this candidate shape instead of directly depending on low-level storage joins

### inbox_selections

Purpose:

Persist the current Inbox inclusion decision so the Inbox page can consume a stable, explainable selection result.

Fields:

- `id`
- `item_id`
- `selected`
- `is_current`
- `relevance_score`
- `score_breakdown`
- `selection_reasons`
- `policy_version`
- `metadata`
- `created_at`
- `updated_at`

Suggested metadata:

- `importance_score`
- `novelty_score`
- `quality_adjustment`
- `topic_group_title`
- `source_name`
- `candidate_window`

Usage rule:

- the Inbox page should prefer current selected rows from `inbox_selections` over recomputing long-term relevance decisions inline
- `selection_reasons` should remain human-readable so selection can be debugged and reviewed
- `score_breakdown` should preserve algorithm component values so future policy changes can be compared against prior results
- failed or outdated selection runs should not overwrite the last known good current selection set

Selection policy rule:

- Inbox relevance should be designed as a policy-driven combination of:
  - hard filters
  - scorer outputs
  - diversity and budget rules
- future changes such as source diversity, freshness decay, or user-feedback weighting should extend policy inputs without changing the Inbox page contract

### notes

Purpose:

Store preservation-worthy knowledge objects built from Items.

V1 note metadata may retain destination-specific sync state for the first Notion and Obsidian adapters until a dedicated knowledge-sync log object is needed.

Fields:

- `id`
- `item_id`
- `note_type`
- `title`
- `body_md`
- `highlights`
- `tags`
- `review_weight`
- `metadata`
- `created_at`
- `updated_at`

V1 note types:

- `reference`
- `summary`

Future note types:

- `insight`

### knowledge_destinations

Purpose:

Store configured knowledge sinks.

V1 may bootstrap one default active destination per supported sink type so the first preservation path is usable before a dedicated destination-management surface exists.

Fields:

- `id`
- `destination_type`
- `name`
- `target_ref`
- `status`
- `metadata`
- `created_at`
- `updated_at`

V1 destination types:

- `notion`
- `obsidian`

States:

- `active`
- `disabled`
- `error`

### digests

Purpose:

Store generated review digests.

Fields:

- `id`
- `digest_type`
- `digest_date`
- `title`
- `content_md`
- `summary`
- `metadata`
- `created_at`

Digest types:

- `daily`
- `weekly`

Constraints:

- unique by `digest_type + digest_date`

### review_objects

Purpose:

Store future review and resurfacing records.

Fields:

- `id`
- `target_type`
- `target_id`
- `review_type`
- `reason`
- `scheduled_at`
- `status`
- `metadata`
- `created_at`
- `updated_at`

Target types:

- `item`
- `note`
- `topic`

Review types:

- `digest_entry`
- `reminder`
- `resurface`
- `topic_review`

States:

- `scheduled`
- `surfaced`
- `dismissed`

### delivery_destinations

Purpose:

Store configured lightweight outbound delivery targets.

Fields:

- `id`
- `destination_type`
- `name`
- `target_ref`
- `status`
- `metadata`
- `created_at`
- `updated_at`

V1 destination types:

- `feishu`

Future destination types:

- `email`
- `telegram`

### delivery_logs

Purpose:

Track delivery attempts for knowledge or review outputs.

Fields:

- `id`
- `destination_id`
- `content_type`
- `content_id`
- `status`
- `message`
- `delivered_at`
- `created_at`

Content types:

- `note`
- `digest`
- `review_object`

Statuses:

- `success`
- `failed`

## Relationships

- one `Source` has one `SourceSyncState`
- one `Source` has many `CaptureEntry` records
- one `CaptureEntry` has many `RawAsset` records
- one `RawAsset` becomes zero or one `Item`
- one `Item` has zero or one current `Enrichment` record in V1
- many `Items` can belong to one `ItemGroup`
- one `Item` can become zero or one `Note` in V1
- one `Note` can be synced to many `KnowledgeDestination` records
- one `Digest` is generated from many `Item` or `Note` references
- one `ReviewObject` points to one `Item`, `Note`, or topic aggregate
- one `DeliveryDestination` can receive many delivery attempts

## State Flow

### Source.status

`active -> paused -> active`

`active -> error -> active`

### CaptureEntry.status

`captured -> normalized`

`captured -> failed`

In V1, a `CaptureEntry` may move directly to `normalized` either after all persisted `RawAsset` records are normalized or after a sync run that produces no new `RawAsset` records, in which case `metadata.normalization.phase` may be `skipped`.

### RawAsset.status

`new -> normalized`

`new -> failed`

### Item.status

`new -> processed -> archived`

Items start as `new` after normalization, become `processed` after the knowledge processing pipeline, and may later be moved to `archived`.

### ReviewObject.status

`scheduled -> surfaced -> dismissed`

## Index Guidance

Important indexes for V1:

- `sources(source_type, status)`
- `capture_entries(source_id, captured_at desc)`
- `raw_assets(capture_entry_id, created_at desc)`
- `items(raw_asset_id)`
- `items(status, published_at desc)`
- `enrichments(item_id)`
- `notes(item_id)`
- `review_objects(target_type, target_id)`
- `digests(digest_date desc)`

## Naming Rules

- use `CaptureEntry` for one capture event
- use `RawAsset` for original captured material
- use `Item` for the normalized information object
- use `Note` for preserved knowledge
- use `KnowledgeDestination` for Notion/Obsidian-style sinks
- use `DeliveryDestination` for lightweight outbound channels
- do not use one overloaded `Destination` type for both knowledge sinks and delivery sinks
