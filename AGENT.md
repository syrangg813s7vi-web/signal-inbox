# AGENT

## Project Summary

Signal Inbox is a personal AI system built around the full information lifecycle.

The product is organized around three value domains:

- `Capture`
- `Knowledge`
- `Review`

The implementation is organized around four stable layers:

- `Capture Layer`
- `Normalization Layer`
- `Knowledge Layer`
- `Review Layer`

Supporting capabilities such as `Delivery` and `Web` exist to serve those domains and layers.

## Current Phase

The repository is currently in Phase 1:

`RSS source -> CaptureEntry -> RawAsset -> Item -> basic knowledge processing -> Inbox`

This is the first implementation target and should be prioritized over adding more sources or advanced features.

## Read These First

Before substantial work, read:

- `README.md`
- `docs/project.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/progress.md`
- `docs/development-style.md`
- `docs/symphony-setup.md`
- `docs/issue-definition.md`
- `WORKFLOW.md` when running under Symphony

## Core Domain Terms

Use these names consistently:

- `Source`
- `SourceSyncState`
- `CaptureEntry`
- `RawAsset`
- `Item`
- `Enrichment`
- `ItemGroup`
- `Note`
- `Digest`
- `ReviewObject`
- `KnowledgeDestination`
- `DeliveryDestination`
- `DeliveryLog`

Do not replace them with synonyms like:

- `Feed`
- `Document`
- `Artifact`
- `Sink` for shared domain objects

## Core Implementation Constraints

- keep Home minimal and result-first
- keep Inbox as the primary work surface
- keep Knowledge as the preservation surface
- keep Review for digest, reminder, and re-surfacing behavior
- do not bypass shared capture and normalization paths
- do not bypass the shared `Item` model
- do not mix capture logic, normalization logic, knowledge logic, delivery logic, and UI logic
- preserve the V1 fixed processing order:
  - `score`
  - `dedupe`
  - `summarize`
  - `classify`
  - `group`

## Development Rules

- follow `docs/development-style.md`
- keep changes incremental
- update docs first if product behavior, architecture, data model, or phase plan changes
- validate the affected path before stopping
- use the repository commit format:
  - `<type>(<scope>): <summary>`

## Current Priorities

1. scaffold repository structure
2. add database schema and migrations
3. implement RSS source CRUD and sync
4. implement CaptureEntry and RawAsset creation
5. implement normalization into Item
6. render the first usable Inbox view

## What Good Work Looks Like

A good change:

- respects the repository docs
- keeps module boundaries clear
- uses stable naming
- is small enough to review and validate
- moves the current phase forward

## Before You Finish

Summarize:

- what changed
- what docs changed
- how the work was validated
- any blockers or follow-up risks
