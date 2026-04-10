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

### Linear Project Slug

Set this in `WORKFLOW.md`:

- `tracker.project_slug`

Replace:

- `replace-with-linear-project-slug`

with your real project slug.

### Workspace Root

Default in `WORKFLOW.md`:

- `~/code/symphony-workspaces`

Ensure this directory exists and is writable.

## Expected Linear Workflow

Recommended repository workflow states:

- `Triage`
- `Spec Update`
- `Ready for Build`
- `In Build`
- `Verification`
- `Human Review`
- `Done`

Current Symphony routing in `WORKFLOW.md` is set to actively work on:

- `Ready for Build`
- `In Build`
- `Rework`

This keeps orchestration focused on implementation work instead of triage-only work.

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
5. Review outputs and validation before marking the issue done.

## Notes

- `WORKFLOW.md` is the official Symphony entrypoint and should remain valid YAML plus Markdown.
- If `WORKFLOW.md` changes, Symphony validates it and may halt scheduling if the file is invalid.
- Running agents continue with their current configuration even if the workflow file is later changed.
