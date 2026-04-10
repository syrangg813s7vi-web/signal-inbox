# Architecture

## Technical Stack

- language: TypeScript
- frontend: Next.js + React
- styling: Tailwind CSS
- API: Next.js Route Handlers
- database: PostgreSQL
- ORM: Drizzle ORM
- queue: Redis + BullMQ
- AI provider: OpenAI API via provider abstraction
- package manager: pnpm
- local development and deployment: Docker Compose

## System Shape

The system is a modular monolith with clear internal boundaries:

- web
- source manager
- connectors
- unified ingest
- processors
- digest generator
- delivery
- database
- jobs

Implementation should preserve those boundaries in both directory structure and runtime behavior.

## Main Modules

### Web

Responsible for rendering the product UI:

- Home
- Inbox
- Digest
- Sources
- Destinations
- Settings

Not responsible for:

- source fetching
- content processing
- delivery to external systems

Internal subareas:

- page routes
- presentational components
- server queries
- server actions
- view-model shaping

### Source Manager

Responsible for:

- creating and updating sources
- enabling and disabling sources
- exposing source state to the UI

Not responsible for:

- fetching content
- summarization
- delivery

Internal subareas:

- source CRUD
- source validation
- source status updates
- source listing for UI

### Connectors

Responsible for:

- fetching raw content from specific source types
- translating source-specific payloads into normalized ingest input
- updating sync cursor state

Supported source types in V1:

- rss
- twitter_list
- wechat

Not responsible for:

- summarization
- topic grouping
- UI rendering
- external delivery

Internal subareas:

- source-specific fetch logic
- source-specific auth or access logic if needed later
- source payload normalization into ingest-ready records
- source cursor update support

### Unified Ingest

Responsible for:

- converting normalized connector output into the shared Item model
- storing raw and cleanable content fields
- creating new processing jobs

Not responsible for:

- AI enrichment
- page rendering
- external delivery

Internal subareas:

- raw connector output validation
- shared Item mapping
- initial Item persistence
- processing job creation

### Processors

Responsible for enriching Items after ingest.

V1 pipeline order:

1. dedupe
2. summarize
3. classify
4. group

Not responsible for:

- source fetching
- direct UI rendering
- direct writes to external destinations

Internal subareas:

- pipeline runner
- dedupe processor
- summarize processor
- classify processor
- group processor

### Digest Generator

Responsible for:

- generating daily and later weekly digests
- summarizing processed items into compressed review output
- storing digest records

Not responsible for:

- source sync
- raw item ingestion
- destination configuration

Internal subareas:

- item selection for digest generation
- digest prompt building
- digest generation via AI provider
- digest persistence

### Delivery

Responsible for:

- sending Items or Digests to external destinations
- tracking delivery results

Supported destination types in V1:

- notion
- obsidian
- feishu

Not responsible for:

- fetching source content
- processing raw source items
- generating summaries

Internal subareas:

- destination CRUD support
- destination-specific formatting
- destination-specific delivery adapters
- delivery result persistence

### Jobs

Responsible for orchestrating async work.

V1 job types:

- source-sync
- item-process
- digest-generate
- delivery

Not responsible for:

- business domain logic that belongs inside connectors, processors, digest generation, or delivery adapters

## Module Interfaces

The following interfaces should stay explicit in code.

### Connector Interface

A connector should accept:

- Source
- optional cursor or sync state

A connector should return:

- a list of normalized ingest-ready records
- optional next cursor

### Ingest Interface

Ingest should accept:

- normalized connector output
- source context

Ingest should return:

- persisted Item identifiers
- initial processing enqueue requests

### Processor Interface

Each processor should accept:

- one Item

Each processor should return:

- an updated Item or processor result that can be merged into Item state

### Delivery Interface

A delivery adapter should accept:

- Destination
- one Item or one Digest

A delivery adapter should return:

- success or failure result
- optional diagnostic message

## Main Data Flow

1. A source is created or enabled.
2. A source-sync job runs.
3. A connector fetches source content.
4. Unified ingest converts connector output into Items.
5. New Items enter the processing pipeline.
6. Processed Items become visible in Inbox and eligible for Home highlights.
7. Digest generation compresses processed Items into a daily summary.
8. Delivery sends Items or Digests to destinations on demand or via default rules.

## Runtime Flows

### Source Sync Flow

1. Source Manager exposes active Sources.
2. A `source-sync` job is triggered on schedule or on demand.
3. The correct connector is selected from `source_type`.
4. The connector fetches records using the current SourceSyncState.
5. Connector output is passed to Unified Ingest.
6. Unified Ingest stores new Items.
7. Unified Ingest enqueues `item-process` jobs.
8. SourceSyncState is updated with the next cursor and sync timestamps.

### Item Processing Flow

1. An `item-process` job loads one Item.
2. The pipeline runner executes processors in order:
   1. dedupe
   2. summarize
   3. classify
   4. group
3. The Item is updated to `processed` if processing succeeds.
4. Processing output becomes available to Inbox, Home highlights, and Digest generation.

### Digest Generation Flow

1. A `digest-generate` job selects processed Items from the relevant time window.
2. The digest generator builds digest input and calls the AI provider.
3. The resulting Digest is stored.
4. The Digest becomes available in the Digest page and optional delivery actions.

### Delivery Flow

1. A delivery request is created from UI action or future automation.
2. A `delivery` job selects the right adapter from `destination_type`.
3. The adapter formats the Item or Digest for the destination.
4. The adapter sends the payload.
5. DeliveryLog stores the result.

## Processing Notes

The first version intentionally uses a fixed processing pipeline rather than a user-configurable workflow engine. This keeps V1 simple and aligned with the product goal of low-friction defaults.

The first version also prefers single-responsibility processors and explicit pipeline order over flexible orchestration.

## Job Contracts

### source-sync

Input:

- `source_id`

Reads:

- Source
- SourceSyncState

Writes:

- Items
- SourceSyncState
- item-process jobs

Success condition:

- connector completes
- any new items are ingested
- sync state is updated

### item-process

Input:

- `item_id`

Reads:

- Item

Writes:

- Item updates
- ItemGroup and ItemGroupMember updates where relevant

Success condition:

- Item completes the fixed processing pipeline
- Item status becomes `processed`

### digest-generate

Input:

- digest type
- target date or time window

Reads:

- processed Items

Writes:

- Digest

Success condition:

- digest is generated and stored

### delivery

Input:

- destination_id
- content_type
- content_id

Reads:

- Destination
- Item or Digest

Writes:

- DeliveryLog

Success condition:

- delivery attempt result is persisted

## UI Data Dependencies

### Home

Needs:

- today item count
- today topic or group count
- top highlights
- digest existence for the current period

Actions:

- navigate to Inbox
- navigate to Digest

### Inbox

Needs:

- processed Items
- grouped Items for grouped view
- filters by time range, source, topic, query

Actions:

- archive Item
- open Item detail
- send Item to Destination

### Digest

Needs:

- digest list
- one selected Digest

Actions:

- view Digest
- send Digest to Destination

### Sources

Needs:

- source list
- source status
- last sync metadata

Actions:

- create Source
- update Source
- enable or disable Source
- trigger sync

### Destinations

Needs:

- destination list
- destination status

Actions:

- create Destination
- update Destination
- test or trigger delivery

### Settings

Needs:

- global model configuration
- digest settings
- summary style settings

Actions:

- update global configuration

## Query and Mutation Boundaries

The web layer should separate read-oriented queries from write-oriented actions.

Queries should:

- shape view data for Home, Inbox, Digest, Sources, and Destinations

Actions should:

- create or update Sources
- trigger sync
- archive Items
- trigger delivery
- update Settings

Business logic should stay out of presentational components.

## Extension Points

The system is designed to grow in three directions:

### New Sources

Add a connector without changing the rest of the pipeline.

Adding a new source type requires:

- a new `source_type`
- a connector implementation
- a cursor or sync strategy
- a normalization mapping into the shared Item model
- validation path and acceptance criteria

### New Processors

Add new item enrichment capabilities after the shared Item model.

Adding a new processor requires:

- clear pipeline placement
- Item input and output definition
- no direct dependency on destination delivery
- validation for success and failure cases

### New Destinations

Add destination adapters without changing source ingestion or processing.

Adding a new destination requires:

- a new `destination_type`
- destination configuration shape
- adapter implementation
- success and failure semantics
- delivery log support

## Architectural Constraints

- all source content must pass through the shared Item model
- processors must not directly deliver to external systems
- delivery adapters must not operate on raw source payloads
- Home must remain a result-first surface, not a dashboard
- web components must not contain source sync or processing logic
- processor logic must not bypass the fixed pipeline order in V1
- new source types must not require a new core content model
