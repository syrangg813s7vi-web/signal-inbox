# Progress

## Current Stage

Planning complete enough to begin implementation.

The project has a defined product direction, architecture, technical stack, data model, and MVP boundary. The next step is implementation through staged vertical slices.

## Planning Rule

Each phase should produce a user-visible or system-validatable result.

Tasks should be small enough to implement and verify, but not so small that they lose product meaning.

## Current Phase

Phase 1: RSS Vertical Slice

## Phase 1 Goal

Run the first complete path:

`RSS -> Item ingest -> basic processing -> Inbox`

This is the first implementation target because:

- RSS is the most stable V1 source type
- it exercises the shared Item model
- it exercises the source sync path
- it exercises the processing pipeline
- it creates the first useful visible product surface

## Phase 1 Planned Work Items

1. Scaffold repository and application structure
2. Add initial database schema and migrations
3. Implement Source CRUD for RSS sources
4. Implement source sync jobs and sync state persistence
5. Implement RSS connector
6. Implement unified ingest into the Item model
7. Implement the minimal processing pipeline:
   - dedupe
   - summarize
   - classify
   - group
8. Implement Inbox list view for processed Items
9. Add minimal validation path for the first slice

## Phase 1 Dependencies

Order constraints:

1. repository and schema before source CRUD
2. source CRUD before source sync jobs
3. source sync jobs before connector execution
4. connector before unified ingest
5. unified ingest before processing
6. processing before Inbox becomes useful

## Phase 1 Acceptance Criteria

Phase 1 is complete when:

- a user can create an RSS source
- the system can schedule or trigger an RSS sync
- RSS entries are stored as Items
- Items move through the processing pipeline
- processed Items appear in Inbox
- the output is good enough to prove the product direction

## Phase 2 Goal

Run the first complete summary path:

`processed Items -> daily Digest -> Home`

## Phase 2 Planned Work Items

1. Implement digest generation job
2. Store generated Digest records
3. Implement Digest page
4. Implement Home page
5. Implement highlight selection query for Home
6. Connect Home and Digest to processed Items

## Phase 2 Acceptance Criteria

Phase 2 is complete when:

- a daily Digest can be generated from processed Items
- Digest records are stored
- Digest page renders a usable summary
- Home shows a minimal summary state and top highlights
- Home remains minimal and does not become a dashboard

## Phase 3 Goal

Run the first complete delivery path:

`Item / Digest -> Destination -> DeliveryLog`

## Phase 3 Planned Work Items

1. Implement Destination CRUD
2. Implement Notion adapter
3. Implement Obsidian adapter
4. Implement Feishu adapter
5. Implement delivery jobs
6. Implement delivery log persistence
7. Add UI actions for sending Items or Digests

## Phase 3 Acceptance Criteria

Phase 3 is complete when:

- a destination can be configured
- an Item can be manually delivered
- a Digest can be delivered
- delivery results are stored in DeliveryLog
- users can understand whether a delivery succeeded or failed

## Phase 4 Goal

Validate source extensibility without changing the core system shape.

Recommended path:

`second source type -> shared ingest -> shared processing -> Inbox / Digest`

## Phase 4 Candidate Work Items

1. Implement Twitter/X list connector or WeChat connector
2. Extend source creation flow for the second source type
3. Validate shared Item mapping for the second source type
4. Confirm Inbox and Digest continue to work without structural change

## Phase 4 Acceptance Criteria

Phase 4 is complete when:

- a second source type enters the same shared Item model
- existing processing still works with minimal change
- existing Inbox and Digest flows still work
- no architectural rewrite is required

## Current Priorities

1. establish project structure
2. create database schema
3. implement the first working source path
4. render the first usable Inbox view
5. validate the RSS vertical slice end to end

## Confirmed Decisions

- the project is a pilot project for ongoing Codex collaboration
- templates are deferred until this project proves the workflow
- the first version is a modular monolith
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
  - Docker Compose
- Home must remain minimal
- Inbox is the primary work surface
- V1 source types are:
  - rss
  - twitter_list
  - wechat
- V1 destination types are:
  - notion
  - obsidian
  - feishu
- V1 processing order is:
  - dedupe
  - summarize
  - classify
  - group

## Immediate Next Steps

1. scaffold repository structure
2. add database schema and migrations
3. implement `sources` and `items` API surface
4. implement RSS connector
5. implement unified ingest flow
6. implement minimal processing pipeline
7. implement basic Inbox page

## Validation Targets For The First Slice

The first slice is successful if:

- a user can create an RSS source
- a sync job can fetch source content
- items are stored in the database
- items are processed into summaries
- Inbox can display processed items

## Open Questions

- what is the best practical implementation path for Twitter/X list ingestion in V1
- what is the best practical implementation path for WeChat account ingestion in V1
- when should Home be implemented relative to Inbox

## Change Notes

### 2026-04-10

- product direction finalized for the pilot project
- architecture, data model, and implementation direction were documented
- project documentation intentionally kept to a minimal 4-file set for the pilot phase
