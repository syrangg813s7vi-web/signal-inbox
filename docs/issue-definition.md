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
- a sync job stores RSS entries as Items
- processed Items appear in Inbox
- a Digest record is generated for the current day

Bad examples:

- system should work better
- UI should feel cleaner
- support RSS completely

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
