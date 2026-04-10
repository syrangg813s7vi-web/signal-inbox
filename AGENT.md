# AGENT

## Project Summary

Signal Inbox is an active personal information operating system that turns noisy, multi-source inputs into low-friction, actionable, and reusable results.

The product is not a generic workflow builder or a raw feed reader. It is a result-first system centered on:

- unified input
- automatic cleanup and summarization
- Inbox-first consumption
- digest generation
- delivery into external tools

## Current Phase

The repository is currently in Phase 1:

`RSS -> Item ingest -> basic processing -> Inbox`

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
- `Item`
- `ItemGroup`
- `Digest`
- `Destination`
- `DeliveryLog`

Do not replace them with synonyms like:

- `Feed`
- `Document`
- `Artifact`
- `Sink`

## Core Implementation Constraints

- keep Home minimal and result-first
- keep Inbox as the primary work surface
- do not bypass the shared `Item` model
- do not mix connector logic, processor logic, delivery logic, and UI logic
- preserve the V1 fixed processing order:
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
4. implement unified Item ingest
5. implement minimal processing pipeline
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
