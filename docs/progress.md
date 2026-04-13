# Progress

## Current Stage

Planning is complete enough to begin implementation under the new architecture.

The project now has:

- a product model based on `Capture`, `Knowledge`, and `Review`
- a four-layer implementation model
- a revised data model for capture, normalization, knowledge, and review
- a clear V1 boundary
- an initial monorepo scaffold plan for `apps/web` and shared packages

The next step is implementation through staged vertical slices.

## Planning Rule

Each phase should produce a user-visible or system-validatable result.

Tasks should be small enough to implement and verify, but not so small that they lose product meaning.

## Current Phase

Phase 1: First Capture-to-Inbox Slice

## Phase 1 Goal

Run the first complete path:

`RSS source -> CaptureEntry -> RawAsset -> Item -> basic knowledge processing -> Inbox`

This is the first implementation target because:

- RSS is the most stable V1 source type
- it exercises the new Capture domain
- it exercises normalization into the shared Item model
- it exercises the first knowledge-processing path
- it creates the first useful visible product surface

## Phase 1 Planned Work Items

1. Scaffold repository and application structure
2. Add initial database schema and migrations for:
   - sources
   - source_sync_state
   - capture_entries
   - raw_assets
   - items
   - enrichments
   - item_groups
   - item_group_members
3. Implement Source CRUD for RSS sources
4. Implement source sync jobs and sync state persistence
5. Implement RSS connector
6. Implement capture flow:
   - source sync creates CaptureEntry
   - CaptureEntry creates RawAsset
7. Implement normalization flow from RawAsset into Item
8. Implement the minimal knowledge pipeline:
   - score
   - dedupe
   - summarize
   - classify
   - group
9. Implement Inbox list view for processed Items
10. Add minimal validation path for the first slice

## Phase 1 Dependencies

Order constraints:

1. repository and schema before source CRUD
2. source CRUD before source sync jobs
3. source sync jobs before connector execution
4. connector before capture persistence
5. capture persistence before normalization
6. normalization before knowledge processing
7. knowledge processing before Inbox becomes useful

## Phase 1 Acceptance Criteria

Phase 1 is complete when:

- a user can create an RSS source
- the system can schedule or trigger an RSS sync
- an RSS sync creates CaptureEntry records
- source material is stored as RawAsset records
- RawAssets are normalized into Items
- Items move through the basic knowledge-processing pipeline
- processed Items appear in Inbox
- the output is good enough to prove the product direction

## Phase 2 Goal

Run the first complete knowledge-preservation path:

`processed Item -> Note -> knowledge sink`

## Phase 2 Planned Work Items

1. Add schema for:
   - notes
   - knowledge_destinations
2. Implement note creation rules for preservation-worthy Items
3. Implement Knowledge page
4. Implement Notion knowledge sink adapter
5. Implement Obsidian knowledge sink adapter
6. Add UI actions for saving Items as Notes
7. Add note sync result visibility

## Phase 2 Acceptance Criteria

Phase 2 is complete when:

- a processed Item can become a Note
- a Note can be sent to Notion
- a Note can be sent to Obsidian
- Knowledge page can display created Notes
- the system clearly separates processed Items from preserved Notes

## Phase 3 Goal

Run the first complete review path:

`processed Item / Note -> Digest -> Home`

## Phase 3 Planned Work Items

1. Add schema for:
   - digests
   - review_objects
2. Implement digest generation job
3. Store generated Digest records
4. Implement Digest page
5. Implement Home page
6. Implement highlight selection for Home
7. Connect Home and Digest to Items and Notes

## Phase 3 Acceptance Criteria

Phase 3 is complete when:

- a daily Digest can be generated from processed Items or Notes
- Digest records are stored
- Digest page renders a usable summary
- Home shows a minimal summary state and top highlights
- Home remains minimal and does not become a dashboard

## Phase 4 Goal

Validate input extensibility without changing the core system shape.

Recommended path:

`second input type -> shared capture -> shared normalization -> shared knowledge flow`

## Phase 4 Candidate Work Items

1. Implement manual saved-link capture
2. Or implement Twitter/X list connector
3. Or implement WeChat connector
4. Validate that the new input enters the same RawAsset -> Item path
5. Confirm Inbox, Knowledge, and Digest continue to work without structural rewrite

## Phase 4 Acceptance Criteria

Phase 4 is complete when:

- a second input type enters the same capture and normalization model
- existing knowledge processing still works with minimal change
- existing Inbox, Knowledge, and Digest flows still work
- no architectural rewrite is required

## Current Priorities

1. establish project structure
2. create database schema for the new model
3. implement the first working capture path
4. implement normalization into Item
5. render the first usable Inbox view
6. validate the first capture-to-inbox slice

## Confirmed Decisions

- the project remains a pilot project for ongoing Codex collaboration
- templates are deferred until this project proves the workflow
- the first version remains a modular monolith
- the stack is:
  - TypeScript
  - Next.js
  - Tailwind CSS
  - PostgreSQL
  - Drizzle ORM
  - Redis
  - BullMQ
  - OpenAI API
  - pnpm
- the product is now structured around:
  - Capture
  - Knowledge
  - Review
- the implementation is now structured around:
  - Capture Layer
  - Normalization Layer
  - Knowledge Layer
  - Review Layer
- Home must remain minimal
- Inbox is the first major work surface
- V1 capture inputs are:
  - rss
  - manual_link
- V1 knowledge sinks are:
  - notion
  - obsidian
- V1 delivery sink is:
  - feishu
- V1 knowledge processing order is:
  - score
  - dedupe
  - summarize
  - classify
  - group
  - note-build later

## Immediate Next Steps

1. scaffold repository structure
2. add database schema and migrations for capture and normalization
3. implement Source CRUD
4. implement RSS connector
5. implement CaptureEntry and RawAsset creation
6. implement normalization into Item
7. implement the minimal knowledge-processing pipeline
8. implement basic Inbox page

## Validation Targets For The First Slice

The first slice is successful if:

- a user can create an RSS source
- a sync job can fetch source content
- capture events are stored
- raw source material is stored
- raw material is normalized into Items
- Items are processed into summaries and tags
- Inbox can display processed Items

## Open Questions

- what is the best practical implementation path for Twitter/X list ingestion after RSS and manual link capture
- what is the best practical implementation path for WeChat ingestion after the new model is in place
- when should Knowledge page be implemented relative to Digest

## Change Notes

### 2026-04-12

- repository scaffolding is now the active first implementation task in Phase 1
- the planned repository shape is a pnpm monorepo with `apps/web` and shared `packages/*` boundaries

### 2026-04-13

- Phase 1 work now includes the first user-visible `Sources` surface for RSS source creation, pause, and reactivation
- source status visibility should show both configured source state and the initialized sync-state baseline without starting sync execution in the same issue
- the first `RawAsset -> Item` normalization slice now exists in code for RSS-backed assets
- capture sync now immediately triggers normalization for newly persisted RSS raw assets in the first V1 orchestration path

### 2026-04-10

- product direction finalized for the pilot project
- architecture, data model, and implementation direction were documented
- project documentation intentionally kept to a minimal 4-file set for the pilot phase
