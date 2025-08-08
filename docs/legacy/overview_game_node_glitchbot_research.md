# Overview of the `game-node` SDK (Virtuals G.A.M.E for Node.js) — Deep Research Dossier

**Audience:** Engineers building a production, autonomous Twitter/X agent (GlitchBot) with Node.js + TypeScript  
**Scope:** How the SDK works, execution flows, design trade-offs, Twitter integration path (twitter-node first), production guidance, and comparisons

---

## 0) Executive Summary

Virtuals **G.A.M.E** for Node.js (`@virtuals-protocol/game`) is an **agentic framework** for **autonomous, long-lived agents** backed by an LLM. The framework uses a **hierarchical design**:

- **GameAgent (HLP):** Owns the goal, breaks it into tasks, delegates to workers.
- **GameWorker (LLP):** Specialized sub-agent with a **limited action space**.
- **GameFunction:** Typed, async **actions/tools** (e.g., call Twitter API, query a DB).

Agents loop continuously: **think → delegate → act → observe → repeat**. This is ideal for a 24/7 social bot that decides whether to reply, quote, or wait based on context and cadence.

For Twitter/X, we use the **twitter node client** `@virtuals-protocol/game-twitter-node` to implement our own **GameFunctions** (reply, quote, like, fetch mentions/timeline). This gives precise control while staying TypeScript-native.

---

## 1) Core Building Blocks

### GameFunction (Action/Tool)

- **Purpose:** A bounded capability the LLM can invoke.
- **Shape:** `name`, `description`, `args` validation, `executable(args, ctx) -> Promise<Result>`.
- **Typical examples for GlitchBot:** `fetchMentionsTimeline`, `fetchHomeTimelineOrAggregate`, `quoteTweet`, `replyTweet`, `likeTweet`, `sendDM`.

### GameWorker (LLP)

- **Purpose:** Plans how to achieve a delegated task using a defined set of GameFunctions.
- **Key fields:** `id`, `name`, `description`, `functions[]`, optional `getEnvironment()`.

### GameAgent (HLP)

- **Purpose:** High-level planner that sets tasks, selects workers, and learns from outcomes.
- **Lifecycle:** `init()` → `run(intervalSec)` or manual `step()`.

---

## 2) Execution Flow (Twitter Lens)

1. **Initialize** the agent & workers (`agent.init()`).
2. **Plan (HLP):** Decide the next task (reply mentions vs. evaluate timeline).
3. **Delegate:** Pick the **Twitter worker** by description match.
4. **LLP loop:** Worker chooses & sequences GameFunctions.
5. **Execute:** Functions perform Twitter API calls.
6. **Feedback:** Worker adapts (retry/skip/finish).
7. **Persist:** Update memory/DB (engaged ids, cadence timestamps).
8. **Repeat:** Run every N seconds (e.g., 60s).

---

## 3) Twitter/X Integration (twitter-node first)

### 3.1 Package

Use `@virtuals-protocol/game-twitter-node` for a preconfigured **twitter-api-v2**-compatible client exposed under `twitterClient.v2`.

**Auth Modes**

- **Single token:** `GAME_TWITTER_TOKEN` (via Virtuals OAuth)
- **App keys:** `TWITTER_APP_KEY`, `TWITTER_APP_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`

### 3.2 Core Calls (generic patterns)

- **Quote tweet**
  ```ts
  await twitterClient.v2.tweet({ text, quote_tweet_id: targetId });
  ```
- **Reply**
  ```ts
  await twitterClient.v2.tweet({
    text,
    reply: { in_reply_to_tweet_id: targetId },
  });
  ```
- **Mentions timeline**
  ```ts
  // if available in the client; else fall back to search
  const mentions = await twitterClient.v2.userMentionTimeline(userId, {
    since_id,
    max_results: 50,
  });
  ```
- **Home timeline or Aggregated feed**
  - If `v2.homeTimeline` exists, use it.
  - Otherwise, aggregate: resolve self, fetch followees, pull recent tweets from a sample, and merge/sort locally.

### 3.3 Optional: Plugin Path

`@virtuals-protocol/game-twitter-plugin` offers a prebuilt worker/functions. We keep it as an **alternative**, but GlitchBot defaults to **twitter-node** to retain control.

---

## 4) GlitchBot Behavior At-a-Glance

- **English-only**; friendly, techy, slightly dark; no hashtags; ≤1 emoji optional.
- **Actions:** reply, quote (no original tweets), like; **DM owner** on issues; no follows; no deletions.
- **Cadence:** quotes ≥ 2h apart; replies ≤ 1/min; sleep 02:00–10:00 UTC‑3 (no posting).
- **Ranking priority:** keywords → rapid engagement → author followers > 5k → positive/inquisitive sentiment.
- **No duplicates:** guard using `engaged_tweets` + memory.

---

## 5) Persistence (SQLite sketch)

```sql
CREATE TABLE engaged_tweets (
  tweet_id TEXT PRIMARY KEY,
  engaged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  action TEXT CHECK(action IN ('reply','quote','like')) NOT NULL
);

CREATE TABLE cadence (
  key TEXT PRIMARY KEY,    -- 'last_quote_ts', 'last_reply_ts'
  value TEXT               -- ISO8601
);

CREATE TABLE suggested_tweets (
  tweet_id TEXT PRIMARY KEY,
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  score REAL NOT NULL,
  reason TEXT
);

CREATE INDEX idx_candidate_score ON suggested_tweets(score DESC);
CREATE INDEX idx_engaged_at ON engaged_tweets(engaged_at);
```

---

## 6) Error Handling

- Handle 429 with exponential backoff + jitter.
- After repeated failures, DM owner and pause quotes for ~30 minutes.
- Log function name, sanitized inputs, outcome, error code, retry count.

---

## 7) Comparison Matrix

| Approach                             | Pros                                         | Cons                                   | Fit |
| ------------------------------------ | -------------------------------------------- | -------------------------------------- | --- |
| **game + twitter-node (default)**    | Fine-grained control; TS-native; transparent | You author GameFunctions               | ★★★ |
| **game + twitter plugin (optional)** | Prebuilt worker & functions                  | Less control/customization             | ★★☆ |
| Raw Twitter API + custom planner     | Max control                                  | Build planner, memory, cadence, safety | ★★☆ |
| LangChain JS Agents + custom tools   | Familiar abstractions                        | Not continuous by default; more glue   | ★★☆ |

---

## 8) Roadmap (high-level)

- **MVP:** mentions reply loop; 2h quote gate; SQLite persistence.
- **Reliability:** backoff; sleep window; owner DM on errors.
- **Tuning:** keyword lists; scoring tweaks; prompt refinements.
- **Scale:** containerize; process manager.

---

**SDK Docs:** https://github.com/game-by-virtuals/game-node
