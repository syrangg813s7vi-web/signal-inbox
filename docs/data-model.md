# Data Model

## Core Domain Objects

- Source
- SourceSyncState
- Item
- ItemGroup
- Digest
- Destination
- DeliveryLog

These names should remain stable across docs, code, and UI-facing implementation details where appropriate.

## Tables

### sources

Purpose:

Store configured information sources.

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

### items

Purpose:

Store all normalized source content after ingest.

Fields:

- `id`
- `source_id`
- `external_id`
- `item_type`
- `title`
- `author`
- `url`
- `published_at`
- `raw_content`
- `clean_content`
- `summary`
- `language`
- `tags`
- `topic`
- `status`
- `importance_score`
- `dedupe_hash`
- `metadata`
- `created_at`
- `updated_at`

Constraints:

- unique by `source_id + external_id`
- unique by `url`

States:

- `new`
- `processed`
- `archived`

V1 item types:

- `article`
- `tweet`
- `video`
- `post`

### item_groups

Purpose:

Store simple topic grouping records for Inbox grouped views.

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

### digests

Purpose:

Store generated digests.

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

### destinations

Purpose:

Store configured external output targets.

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
- `feishu`

### delivery_logs

Purpose:

Track delivery attempts for Items and Digests.

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

- `item`
- `digest`

Statuses:

- `success`
- `failed`

## Relationships

- one Source has one SourceSyncState
- one Source has many Items
- many Items can belong to one ItemGroup
- one Digest is generated from many processed Items
- one Destination can receive many delivery attempts

## State Flow

### Source.status

`active -> paused -> active`

`active -> error -> active`

### Item.status

`new -> processed -> archived`

Items start as `new` after ingest, become `processed` after the processing pipeline, and may later be moved to `archived` by user action or future rules.

## Index Guidance

Important indexes for V1:

- `sources(source_type, status)`
- `items(source_id, published_at desc)`
- `items(topic, published_at desc)`
- `items(status, published_at desc)`
- `items(dedupe_hash)`
- `digests(digest_date desc)`

## Naming Rules

- use `Item`, not `Document` or `Artifact`, for the main normalized content object
- use `Destination`, not `Sink`, in product-facing docs
- use `Source`, not `Feed`, as the generic input concept
- only introduce new domain object names when the current model is insufficient
