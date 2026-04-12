# Symphony Setup

## Purpose

This file describes the repository-specific setup needed to run Symphony against Signal Inbox.

It complements `WORKFLOW.md` and keeps operational notes close to the repository.

## Official Basis

This repository setup follows the Symphony quickstart and workflow file guidance:

- Symphony uses `WORKFLOW.md` as its core configuration artifact.
- The workflow file combines YAML frontmatter and a Markdown prompt template.
- Symphony polls Linear for eligible issues and creates isolated workspaces.

## Required External Inputs

Before running Symphony, configure:

- a Linear project
- a Linear personal API key
- Codex app-server availability
- a writable workspace root on the local machine

## Required Values

### LINEAR_API_KEY

Required by Symphony for Linear access.

### DATABASE_URL

Required for repository paths that talk to PostgreSQL directly.

For `pnpm db:smoke`, either:

- activate the repository Node version from `.nvmrc` (`22.22.2`) or another compatible Node 22 runtime first
- set `DATABASE_URL` to a disposable PostgreSQL database
- or run on a machine with local PostgreSQL CLI tools available so the smoke test can start a temporary cluster with `initdb`, `pg_ctl`, and `createdb`

### Linear Project Slug

Set this in `WORKFLOW.md`:

- `tracker.project_slug`

### Workspace Root

Default in `WORKFLOW.md`:

- `~/code/symphony-workspaces`

Ensure this directory exists and is writable.

## Expected Linear Workflow

The current repository workflow is centered on these active and review states:

- `In Progress`
- `In Review`

Terminal state:

- `Done`

This keeps orchestration focused on active implementation and explicit human review handoff.

## Required Repository Context

Symphony agents should always read:

- `README.md`
- `docs/project.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/progress.md`
- `docs/development-style.md`
- `docs/issue-definition.md`

## Suggested Run Pattern

1. Create or refine the issue in Linear.
2. Ensure the issue has a clear scope and acceptance criteria.
3. Move the issue into an active implementation state.
4. Start Symphony against this repository's `WORKFLOW.md`.
5. When the work is branch / commit / push / PR ready and the Vercel preview URL requirement is met for web-facing work, move it to `In Review`.
6. Mark the issue `Done` only after human review and acceptance.

## Architecture Alignment

Symphony work should align with the repository's current architecture:

- product domains:
  - `Capture`
  - `Knowledge`
  - `Review`
- implementation layers:
  - `Capture Layer`
  - `Normalization Layer`
  - `Knowledge Layer`
  - `Review Layer`

The first implementation slice is:

- `RSS source -> CaptureEntry -> RawAsset -> Item -> basic knowledge processing -> Inbox`

## Review Exposure

For web-facing changes in the debugging stage:

- use Vercel preview deployments as the review surface
- include the concrete Vercel preview URL in the handoff
- do not treat a local-only URL as sufficient review exposure
- if preview deployments have a database configured but are missing current schema, the affected web path may bootstrap pending migrations on first access so the review surface can become usable without a separate manual migration step

## Notes

- `WORKFLOW.md` is the official Symphony entrypoint and should remain valid YAML plus Markdown.
- If `WORKFLOW.md` changes, Symphony validates it and may halt scheduling if the file is invalid.
- Running agents continue with their current configuration even if the workflow file is later changed.
