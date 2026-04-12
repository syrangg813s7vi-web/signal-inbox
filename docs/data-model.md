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

Future source types:

- `twitter_list`
- `wechat`
- `youtube`
- `podcast`

### source_sync_state

Purpose:

Store the latest sync position and sync health for each source.

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

Constraints:

- unique by `canonical_url` when present

States:

- `new`
- `processed`
- `archived`

V1 item types:

- `article`

Future item types:

- `tweet`
- `video`
- `audio`
- `note_candidate`

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
- `ai_commentary`
- `dedupe_key`
- `metadata`
- `created_at`
- `updated_at`

Constraints:

- one current enrichment record per item in V1 is acceptable

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

### item_group_members

Purpose:

Map Items into ItemGroups.

Fields:

- `group_id`
- `item_id`

Constraints:

- unique pair of `group_id + item_id`

### notes

Purpose:

Store preservation-worthy knowledge objects built from Items.

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
