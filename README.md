# GlitchBot – AI Twitter Agent

GlitchBot is an autonomous agent that replies to mentions with context and posts cadence‑safe quote tweets in AI/crypto/tech topics. It is built on a simple, layered architecture with a rate‑limited Twitter client and a persistent SQLite backend.

## Overview

Main capabilities:

- Context‑aware replies to mentions (references the exact tweet and author when users share content)
- Curate referenced tweets into a suggestions pool for later quoting
- Quote‑tweet from home timeline plus suggestions, with duplication and cadence guards

## Components

- Agent (orchestrator): high‑level rules and schedule
- Workers (implemented):
  - MentionsWorker (`src/workers/mentions-worker.ts`): fetch mentions, link each mention to referenced tweets, reply with context, update queue state
  - Timeline Worker (`src/workers/timeline-worker.ts`): fetch home timeline, mix recent suggestions, quote‑tweet with 1‑hour cadence and duplicate prevention
- Functions:
  - Mentions: `src/functions/mentions/*`
  - Timeline: `src/functions/timeline/*`

## Data & Rate Limiting

- Storage: SQLite (`glitchbot.db`) via `DatabaseManager`
- Key tables: `pending_mentions`, `mention_state`, `suggested_tweets`, `engaged_mentions`, `engaged_quotes`, `rate_limits`, `timeline_state`, `cadence`
- Rate limiting: transparent client wrapper that tracks per‑endpoint usage across 15‑min/hour/day windows and prevents duplicate or out‑of‑cadence actions

## Operation

- Replies: ≥ 60 seconds between replies; mentions prioritized
- Quotes: ≥ 1 hour between quotes; excludes self; duplicate prevention via `engaged_quotes`
- Topic guard: AI/crypto/software/tech
- Sleep window: 05:00–13:00 UTC (read/store only)

## Setup

Prerequisites: Node.js 20+, TypeScript, Twitter API access, Virtuals G.A.M.E key

1. Install and configure env

```bash
npm install
cp env.example .env
# set required tokens/keys
```

2. Build/run

```bash
npm run build
npm run start
```

Helpful commands

```bash
npm run db:inspect   # database overview
npm run queue:status # queue and rate‑limit snapshot
```

## Documentation

- `docs/architecture-overview.md`
- `docs/workers/mentions-worker.md`
- `docs/workers/timeline-worker.md`
- `docs/database-schema.md`
