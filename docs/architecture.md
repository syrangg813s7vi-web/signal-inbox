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

AI usage rule:

- normalization should remain primarily deterministic
- model calls in this layer are optional and limited to narrow cleanup tasks such as fallback language detection or light extraction repair
- this layer must not own ranking, summarization, preservation decisions, or review synthesis

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

AI entry rule:

- the first-class AI entrypoint for the product is the Knowledge Layer
- model-backed reasoning should operate on normalized `Item` records, not directly on raw capture payloads
- provider and model selection must be configurable from one explicit configuration boundary rather than hard-coded across business logic
- the default sequence remains:
  - `score`
  - `dedupe`
  - `summarize`
  - `classify`
  - `group`
  - `preserve`

AI output rule:

- AI should produce structured enrichment output, not only free-form text
- enrichment metadata should retain the provider, model, and prompt-version used for generation
- the minimum structured output should support:
  - summary
  - key points
  - classification
  - tags
  - importance score
  - novelty score
  - why-it-matters reasoning
  - preservation recommendation
  - optional note draft

Layer boundary:

- `Capture Layer` does not make AI decisions
- `Normalization Layer` may use limited repair assistance, but does not own AI ranking or summary logic
- `Knowledge Layer` owns model-backed judgment and note-preservation decisions
- `Review Layer` may use AI to synthesize digests and resurfacing output from processed and preserved objects

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

AI role:

- review uses AI after the knowledge pipeline, not instead of it
- the review layer should synthesize from processed `Item`, `Enrichment`, and `Note` data rather than re-parsing raw captured material

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

Frontend boundary rule:

- web surfaces should consume server-shaped view models rather than raw database records or raw capture payloads
- page layout changes should normally affect:
  - page-specific components
  - page-specific server view shaping
- page layout changes should not require changes to capture, normalization, or knowledge-processing modules

Inbox surface rule:

- Inbox should use a dedicated reader-style layout instead of inheriting a generic dashboard shell
- the preferred page structure is:
  - `ReaderSidebar`
  - `ReaderHeader`
  - `ReaderTabs`
  - `ReaderSortBar`
  - `ReaderList`
  - `ReaderListItem`
- the list item is the primary unit of interaction, not the oversized card
- row content should be shaped from a stable Inbox view model rather than assembled ad hoc inside leaf UI components

Reader list-item contract:

- each Inbox row should follow one stable horizontal anatomy:
  - `AccentRail`
  - `ThumbSlot`
  - `ContentColumn`
  - `DateSlot`
  - `ActionSlot`
- `ContentColumn` should carry the reading hierarchy:
  - `TitleLine`
  - `ExcerptLine`
  - `MetaLine`
- the title is the strongest visual element
- the excerpt is secondary and should remain shorter than the title block
- metadata should sit on one compact line when possible
- the date should be visually detached from the content column and right-aligned
- action controls should be visually secondary and must not compete with the title or excerpt
- the list item should read as a compact media row, not as a boxed dashboard card or a generic data table row

Inbox view-model rule:

- the server layer should expose a page-specific row model that contains the fields needed for layout, such as:
  - title
  - excerpt or summary
  - source name
  - source topic
  - classification
  - tags
  - published or moved date label
  - importance and novelty scores when used
  - destination URL when present
- presentational components should not derive these semantics directly from low-level persistence records

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
