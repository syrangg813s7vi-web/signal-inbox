# Project

## Architecture Declaration

Signal Inbox is a personal AI system built around the full information lifecycle.

Its job is to support this lifecycle:

`capture -> understand -> preserve -> revisit`

The product is organized around three long-term value domains:

- `Capture`
- `Knowledge`
- `Review`

The implementation is organized around four stable layers:

- `Capture Layer`
- `Normalization Layer`
- `Knowledge Layer`
- `Review Layer`

Supporting capabilities such as `Delivery` and `Web` exist to serve those domains and layers, not to replace them.

Long-term architecture rules:

1. all inputs must enter the system through shared capture and normalization paths
2. knowledge preservation and lightweight delivery must remain separate concepts
3. review must depend on processed or preserved objects, not on raw input directly
4. web surfaces display results and actions, but do not own the core processing logic
5. future capabilities should extend the existing domains and layers rather than creating disconnected special cases

## One-line Positioning

Signal Inbox is a personal AI system for capture, knowledge building, and review.

It turns noisy inputs into structured, reusable knowledge and then helps the user revisit what matters.

## Product Domains

The product is organized around three value domains:

- `Capture`
  - get information into the system with low friction
- `Knowledge`
  - transform inputs into structured, reusable knowledge
- `Review`
  - re-surface the right information at the right time

## Primary User

The first user is a high-input individual user who follows AI, news, and long-form content across multiple channels, wants AI help with filtering and summarization, and values long-term knowledge capture more than raw feed reading.

## Core Problem

Current information intake is fragmented, repetitive, and difficult to turn into durable knowledge.

The user does not need more feeds. The user needs a system that:

- captures information from multiple channels
- normalizes different input formats into one shared structure
- reduces noise and duplication
- scores and summarizes what matters
- turns high-value information into reusable notes
- re-surfaces the right content later through digest and review flows

## Product Goal

The goal is not to build a better RSS reader.

The goal is to build a personal AI operating layer that supports this lifecycle:

`capture -> understand -> preserve -> revisit`

## MVP Scope

The first version should prove the full lifecycle with a narrow source set and a narrow review surface.

### Capture

- RSS feeds
- manual saved links

### Knowledge Processing

- content extraction
- normalization into shared Items
- scoring
- deduplication
- short AI summarization
- basic tagging
- simple topic grouping
- note creation

### Product Surfaces

- Home
- Inbox
- Knowledge
- Digest
- Sources
- Settings

### Knowledge Sinks

- Notion
- Obsidian

### Delivery Sinks

- Feishu

## Explicit Non-Goals For V1

- no visual workflow editor
- no team collaboration
- no advanced automation builder
- no broad source coverage beyond the first source set
- no complex knowledge graph
- no chat-first AI UX
- no fully automated reminder engine beyond a minimal digest/review path

## Product Surfaces

### Home

Minimal landing page. Shows the most important things to review now.

### Inbox

Primary input-processing surface. Shows processed Items, not raw feeds.

### Knowledge

Shows Notes created from high-value Items and makes the knowledge layer visible.

### Digest

Compressed review surface for daily and later weekly review output.

### Sources

Manages capture sources and source status.

### Settings

Only global settings. No advanced workflow editing in V1.

## Product Principles

### Capture Without Friction

The system should make it easy to get information in before asking the user to classify it.

### Result Over Raw

The product should prioritize processed information over raw streams.

### Knowledge Over Collection

The system should help the user preserve what matters, not merely save everything.

### Review Creates Value

Long-term value comes from re-surfacing and revisiting information, not only from first-pass reading.

### Strong Defaults

The first version should work well with very little setup.

### Progressive Disclosure

Advanced controls must be hidden from the main flow.

### Quiet Interface

The interface should feel calm, focused, and low-noise. Home should not behave like an admin dashboard.

## Core User Flow

1. A source is added or a link is manually captured.
2. The system stores the raw input and normalizes it into an Item.
3. The system scores, deduplicates, summarizes, and groups the Item.
4. The user opens Home or Inbox to review important processed results.
5. High-value Items can be turned into Notes and synced to knowledge sinks.
6. The user reads a Digest and later review surfaces to revisit important content.
