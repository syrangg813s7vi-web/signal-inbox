# Issue Definition

## Purpose

This file defines the minimum issue quality bar for work that will be executed through Linear and Symphony.

This is a project-specific contract for Signal Inbox.

## Minimum Required Fields

Each implementation issue should contain:

- background
- goal
- scope
- constraints
- acceptance criteria

## Good Issue Shape

A good issue:

- describes one coherent change
- has a clear affected area
- can be validated
- does not bundle unrelated work

## Preferred Categories

Use one of these categories where practical:

- new source
- new processing capability
- new destination
- ui or ux refinement
- docs
- bug

## Acceptance Criteria Rules

Acceptance criteria should be observable and testable.

Good examples:

- a user can create an RSS source from the Sources page
- a sync job stores RSS entries as CaptureEntry and RawAsset records
- RawAssets are normalized into Items
- processed Items appear in Inbox
- a Digest record is generated for the current day

Bad examples:

- system should work better
- UI should feel cleaner
- support RSS completely

## Linear State Rules

Use these meanings consistently:

- `In Progress`
  - the issue is actively being implemented, investigated, or validated
- `In Review`
  - the issue meets acceptance criteria and is ready for human review
- `Done`
  - the work has passed human review or has otherwise been explicitly accepted by a human

Do not move an issue to `In Review` if the work only exists as local uncommitted changes.

The normal condition for `In Review` is:

- acceptance criteria met
- focused commit created
- branch pushed
- PR or review handoff prepared
- any actionable PR review feedback has been addressed or explicitly answered with justified pushback

If the issue changes a runnable website or app surface, `In Review` also requires:

- the site is available through a Vercel preview deployment
- the handoff includes the concrete Vercel preview URL for human review
- the affected preview route is validated directly, not inferred only from typecheck, build, or deployment status
- the primary user path for the issue works in the preview environment

If a PR already exists, do not treat the issue as review-ready while actionable PR comments remain unresolved.

Blocked work should remain blocked rather than being advanced to a review or done state.

## Issue And Docs Relationship

If an issue changes any of the following, docs should be updated first or together with the implementation:

- product behavior
- page structure
- architecture boundaries
- data model
- phase plan
- development conventions

## Suggested Issue Template

### Background

Why is this needed?

### Goal

What should be true after this issue is complete?

### Scope

What is included and what is explicitly excluded?

### Constraints

What must remain unchanged?

### Acceptance Criteria

What observable results define completion?

For web-facing issues, include a criterion equivalent to:

- the Vercel preview deployment is available and a review URL is provided
- the affected preview route loads successfully
- the primary user action path works in preview
