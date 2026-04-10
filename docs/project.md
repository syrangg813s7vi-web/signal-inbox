# Project

## One-line Positioning

An active personal information operating system that turns noisy, multi-source inputs into low-friction, actionable, and reusable results.

## Primary User

The first user is a high-input individual user who follows AI, news, and video content across multiple channels, values systems and long-term knowledge capture, and prefers low-maintenance tools over highly configurable systems.

## Core Problem

Current information intake is fragmented, noisy, repetitive, and difficult to turn into something reusable. The user does not need more inputs. The user needs a system that:

- ingests multiple sources into one place
- reduces noise and duplication
- generates readable summaries
- supports later action and knowledge capture
- sends useful outputs into existing tools

## MVP Scope

The first version supports this end-to-end flow:

- input sources:
  - Twitter/X lists
  - WeChat public accounts
  - RSS feeds
- processing:
  - deduplication
  - short AI summarization
  - basic tagging
  - simple topic grouping
- product surfaces:
  - Home
  - Inbox
  - Digest
  - Sources
  - Destinations
  - Settings
- outputs:
  - Notion
  - Obsidian
  - Feishu

## Explicit Non-Goals For V1

- no visual workflow editor
- no team collaboration
- no advanced automation builder
- no broad source coverage beyond the first source set
- no complex knowledge graph
- no chat-first AI UX

## Product Surfaces

### Home

Minimal landing page. Shows only the most important results for today and provides entry into Inbox and Digest.

### Inbox

Primary work surface. Shows processed content, not raw feeds.

### Digest

Compressed daily or weekly summary view.

### Sources

Manage source connections and source status.

### Destinations

Manage output targets such as Notion, Obsidian, and Feishu.

### Settings

Only global settings. No advanced workflow editing in V1.

## Product Principles

### Inbox First

The primary user value comes from opening the product and immediately seeing processed results.

### Result Over Raw

The product should prioritize cleaned and summarized output over raw streams.

### Strong Defaults

The first version should work well with very little setup.

### Low Friction

The product should minimize navigation, configuration, and maintenance.

### Progressive Disclosure

Advanced controls must be hidden from the main flow.

### Quiet Interface

The interface should feel calm, focused, and low-noise. Home should not behave like an admin dashboard.

## Core User Flow

1. Add a source.
2. The system syncs source content automatically.
3. The system converts content into processed items.
4. The user opens Home or Inbox to review important results.
5. Important items can be sent to Notion, Obsidian, or Feishu.
6. The user reads a daily Digest for compressed review.
