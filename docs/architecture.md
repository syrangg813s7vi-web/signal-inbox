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
- debug and review website exposure: Vercel preview deployments
- backend deployment target: self-hosted jobs and data services

## System Shape

The system is a modular monolith with three product domains and four implementation layers.

### Product Domains

- `Capture`
- `Knowledge`
- `Review`

### Implementation Layers

- `Capture Layer`
- `Normalization Layer`
- `Knowledge Layer`
- `Review Layer`

This shape keeps the system aligned with the information lifecycle instead of centering the design only around source ingestion.
This shape keeps the system aligned with the information lifecycle.

## Layer Model

### 1. Capture Layer

Responsible for getting information into the system.

Main responsibilities:

- source management
- manual capture entry
- connector execution
- raw asset persistence

Primary concepts:

- `Source`
- `CaptureEntry`
- `RawAsset`

Not responsible for:

- AI summarization
- knowledge sink sync
- digest generation

Main modules:

- `capture-manager`
- `connectors`
- `manual-capture`
- `raw-storage`

### 2. Normalization Layer

Responsible for converting different raw inputs into one shared information object.

Main responsibilities:

- content extraction
- metadata normalization
- OCR when needed later
- transcription when needed later
- Item creation

Primary concept:

- `Item`

Not responsible for:

- importance scoring
- note creation
- digest generation

Main modules:

- `extractor`
- `transcription`
- `ocr`
- `normalizer`

### 3. Knowledge Layer

This is the main AI processing and preservation layer.

Main responsibilities:

- scoring
- deduplication
- summarization
- tagging and classification
- topic grouping
- AI enrichment
- note creation
- knowledge sink sync

Primary concepts:

- `Item`
- `Enrichment`
- `ItemGroup`
- `Note`

Not responsible for:

- raw source fetching
- review scheduling
- generic outbound notification logic

Main modules:

- `scorer`
- `deduper`
- `summarizer`
- `classifier`
- `grouper`
- `enricher`
- `note-builder`
- `knowledge-sync`

### 4. Review Layer

Responsible for re-surfacing information and knowledge later.

Main responsibilities:

- digest generation
- review generation
- reminder selection
- topic review selection

Primary concepts:

- `Digest`
- `ReviewObject`

Not responsible for:

- source ingestion
- raw content normalization
- note persistence

Main modules:

- `digest-generator`
- `review-generator`
- `reminder-engine`

## Supporting Runtime Areas

### Web

Responsible for the user-facing product UI:

- Home
- Inbox
- Knowledge
- Digest
- Sources
- Settings

Not responsible for:

- source fetching
- Item processing
- note sync execution
- review scheduling

Debug and review-stage expectation:

- website review happens through Vercel preview deployments
- Vercel is the temporary website exposure layer for human review
- self-hosted runtime remains the target for jobs and data services

### Jobs

Responsible for orchestrating async work across the four implementation layers.

V1 job families:

- `capture-sync`
- `normalize-item`
- `process-item`
- `knowledge-sync`
- `digest-generate`
- `review-generate`
- `delivery`

### Delivery

Delivery is a supporting capability, not a primary domain.

It should be split conceptually into:

- `knowledge sinks`
  - Notion
  - Obsidian
  - Memos later
- `delivery sinks`
  - Feishu
  - Email later
  - Telegram later

Knowledge sinks are part of knowledge preservation.
Delivery sinks are lightweight distribution channels.

## Main Modules

### Capture Manager

Responsible for:

- creating and updating Sources
- enabling and disabling Sources
- creating manual capture entries
- exposing capture state to the UI

Not responsible for:

- content processing
- note sync
- review generation

### Connectors

Responsible for:

- fetching raw content from source types
- converting source payloads into raw assets or ingest-ready records
- updating source sync state

V1 source types:

- rss
- manual_link

Future source types:

- twitter_list
- wechat
- youtube
- podcast
- bot_forward

### Normalizer

Responsible for:

- turning raw assets into Items
- extracting content text
- standardizing metadata
- producing a consistent representation for later processing

### Knowledge Processing

Responsible for running the AI-assisted processing chain.

V1 processing order:

1. score
2. dedupe
3. summarize
4. classify
5. group
6. note-build

This layer should remain modular, but V1 keeps the pipeline fixed instead of user-configurable.

### Knowledge Sync

Responsible for persisting Notes to knowledge sinks.

V1 knowledge sinks:

- notion
- obsidian

### Review Generator

Responsible for generating:

- daily digest
- later weekly review
- later reminder flows

## Module Interfaces

### Connector Interface

Accepts:

- `Source`
- optional `SourceSyncState`

Returns:

- one or more `RawAsset`-like records
- optional next cursor

### Normalization Interface

Accepts:

- `RawAsset`
- optional source context

Returns:

- one persisted `Item`
- optional follow-up jobs

### Knowledge Processor Interface

Accepts:

- one `Item`

Returns:

- updated Item state
- one or more enrichment results
- optional note creation result

### Knowledge Sink Interface

Accepts:

- `Note`
- `KnowledgeDestination`

Returns:

- success or failure result
- optional diagnostic message

### Review Interface

Accepts:

- one or more `Note` or `Item` references
- time window or review policy

Returns:

- `Digest` or `ReviewObject`

## Main Data Flow

1. A source is added or a manual capture entry is created.
2. The Capture Layer stores a raw input event as `CaptureEntry` and `RawAsset`.
3. The Normalization Layer converts the raw asset into a shared `Item`.
4. The Knowledge Layer scores, deduplicates, summarizes, classifies, groups, and enriches the Item.
5. High-value Items can be converted into `Note` records.
6. Notes are synced to knowledge sinks.
7. The Review Layer selects Items and Notes to generate Digests and future review objects.
8. Web surfaces render Inbox, Knowledge, Digest, and review entry points.

## Runtime Flows

### Capture Flow

1. A source sync or manual capture event occurs.
2. The Capture Layer stores the input as `CaptureEntry`.
3. One or more `RawAsset` records are created.
4. V1 immediately triggers normalization for each new `RawAsset` after capture persistence.
5. Capture-level failures only reflect fetch and capture persistence problems; downstream normalization or knowledge failures are recorded on their own layer objects without rewriting source sync state as a capture failure.

### Normalization Flow

1. A normalization job loads one `RawAsset`.
2. Extraction and metadata cleanup run.
3. The result is stored as one `Item`.
4. The `RawAsset` and `CaptureEntry` statuses are advanced for the first slice.
5. V1 immediately follows normalization by running the fixed knowledge processing job for each new `Item`.

### Knowledge Flow

1. A processing job loads one `Item`.
2. The fixed pipeline executes in order: `score -> dedupe -> summarize -> classify -> group`.
3. The Item is updated with persisted enrichment, topic grouping, and debugging metadata for Inbox consumption.
4. A Note may be created if the item is preservation-worthy.
5. In V1, preservation-worthiness may be decided from persisted enrichment output such as importance, novelty, and duplicate status rather than a separate user-authored rule engine.
6. In V1, initial knowledge sync may run immediately after Note creation so the first `processed Item -> Note -> knowledge sink` path is directly testable before a dedicated sync scheduler exists.
7. Destination-specific sync results should be recorded on the Note metadata so the Knowledge surface can show what happened without collapsing knowledge sinks into generic delivery logs.
8. Topic group creation must converge on one stable group per `group_type + tag` even under concurrent processing.

### Review Flow

1. Review generation selects relevant Items or Notes.
2. A Digest or ReviewObject is generated.
3. The result becomes visible in Home, Digest, and later Review UI.

## Design Rules

- Do not bypass `RawAsset` and `Item` when adding new input types.
- Do not treat knowledge sinks and delivery sinks as the same thing.
- Do not let review logic mutate capture or normalization logic.
- Keep web UI separate from capture, knowledge, and review execution.
- Prefer stable shared object boundaries over source-specific special cases.
