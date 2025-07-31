# Overview of the `game-node` SDK (Virtuals G.A.M.E for Node.js) — Deep Research Dossier

**Author:** ChatGPT  
**Audience:** Engineers building a production, autonomous Twitter/X agent (GlitchBot) with Node.js + TypeScript  
**Scope:** How the SDK works, execution flows, design trade-offs, Twitter integration path, production guidance, and comparisons

---

## 0) Executive Summary

Virtuals **G.A.M.E** for Node.js (published as `@virtuals-protocol/game`) is an **agentic framework** that lets you run **autonomous, long-lived agents** backed by an LLM. The framework uses a **hierarchical design**:

- **Agent (High-Level Planner, HLP):** Owns the *goal*, breaks it into tasks, and delegates to workers.
- **Workers (Low-Level Planners, LLP):** Specialized sub-agents with a **limited action space**.
- **GameFunctions:** Typed, asynchronous **actions/tools** (e.g., call Twitter API, query a DB).

The Agent continuously loops: **think → delegate → act → observe → repeat**. This architecture is well-suited for a 24/7 social bot that must plan what to do next (reply, quote, wait, etc.), not just execute a fixed schedule.

For Twitter/X, the ecosystem provides an official **Twitter plugin** (`@virtuals-protocol/game-twitter-plugin`) exposing functions like `searchTweets`, `replyTweet`, `quoteTweet`, and `likeTweet`. This drastically reduces integration work and enables a production path with minimal glue code.

---

## 1) Core Building Blocks

### 1.1 GameFunction (Action/Tool)
- **What it is:** A small, composable function the LLM can ask the worker to run.
- **Shape (conceptually):**
  - `name: string`
  - `description: string` (what it does, when to use)
  - `args: zod-like schema` (runtime validation pattern)
  - `executable: (args, ctx) => Promise<{ status: "Done" | "Failed"; message?: string; data?: any }>`
- **Role:** Encapsulates an **external capability** (HTTP API call, DB op, compute task). The LLM does *not* call HTTP directly; it picks a GameFunction that you provide.

### 1.2 GameWorker (LLP)
- **What it is:** A **specialized sub-agent** that plans *how* to accomplish a specific task using a constrained set of GameFunctions.
- **Key fields:**
  - `id`, `name`, `description` (this description is what the HLP sees when deciding where to delegate).
  - `functions: GameFunction[]`
  - Optional `getEnvironment: () => any` (context visible to the worker’s LLM loop).

### 1.3 GameAgent (HLP)
- **What it is:** The **top-level planner**. It receives a high-level `goal`, a persona/`description`, optional global `getAgentState`, and a list of workers.
- **Responsibilities:**
  - Continuously **generate tasks** consistent with the goal.
  - **Choose a worker** to execute each task.
  - **Incorporate feedback** from workers to decide the next step.
- **Lifecycle:**
  - `await agent.init()` → wire up keys/config.
  - `await agent.run(intervalSeconds, { verbose })` → periodic loop.
  - Or call `await agent.step()` manually inside your own scheduler.

---

## 2) Execution Flow (Twitter Bot Lens)

1. **Initialize** the agent and workers (`agent.init()`).
2. **Plan a Task (HLP):** Given the goal (“grow engagement via replies/quotes”), the agent proposes a task like “Check mentions and reply to relevant ones.”
3. **Delegate to Worker:** The agent selects the **Twitter worker** based on its description.
4. **Worker’s Agentic Loop (LLP):** The worker decides **which functions** to call and in what order (e.g., `searchTweets` → filter results → `replyTweet`).
5. **Execute Functions:** Each function performs a real side-effect (Twitter API call) and returns a structured result.
6. **Process Feedback:** Worker adapts to outcomes (retry, choose another candidate, or conclude).
7. **State Update:** Persist useful memory (tweet IDs engaged, last quote time, etc.).
8. **Repeat:** The agent keeps going at the specified cadence (e.g., every 60s).

This loop enables **adaptive behavior**: the bot can choose to reply now, wait, or search for better content later—rather than blindly posting on a timer.

---

## 3) Twitter/X Integration

### 3.1 Official Plugin
- Package: `@virtuals-protocol/game-twitter-plugin`
- Typical capabilities provided out-of-the-box:
  - `searchTweets(query)` — discover content (timeline/keyword-based)
  - `replyTweet(tweetId, text)` — reply under a tweet (mentions OK)
  - `quoteTweet(tweetId, text)` — retweet-with-comment
  - `likeTweet(tweetId)` — endorsement signal
- **Auth options:** GAME Twitter token (via Virtuals OAuth) *or* standard Twitter app keys/tokens.
- **Benefit:** A ready-made **TwitterWorker** so you can plug into `workers[]` immediately.

### 3.2 Minimal Scaffold (TypeScript)
```ts
import { GameAgent } from "@virtuals-protocol/game";
import { TwitterPlugin, GameTwitterClient } from "@virtuals-protocol/game-twitter-plugin";

const twitter = new GameTwitterClient({ accessToken: process.env.GAME_TWITTER_TOKEN! });
const twitterWorker = new TwitterPlugin({ twitterClient: twitter }).getWorker();

const agent = new GameAgent(process.env.VIRTUALS_API_KEY!, {
  name: "GlitchBot",
  goal: "Grow engagement by interacting with mentions and by quote-tweeting high-signal posts.",
  description: "English-only. Friendly, techy, slightly dark. Values integrity. Avoid fluff.",
  workers: [twitterWorker],
  // getAgentState: optional global state snapshot
});

await agent.init();
await agent.run(60, { verbose: true });
```

### 3.3 Custom Functions (When Needed)
If the default worker doesn’t expose a needed primitive (e.g., explicit *mentions timeline* or *home timeline*), add a **custom GameFunction** using the underlying `twitter-api-v2` client the plugin already configures. Examples:
- `fetchMentions()` → get latest mentions of `@glitchbot_ai`.
- `fetchHomeTimeline()` → fetch and locally rank timeline tweets.
- `sendDM(userId, text)` → DM the owner on errors.

---

## 4) GlitchBot-Specific Behavioral Contract (from product requirements)

**Language:** English-only.  
**Persona & Tone:** Friendly, techy, slightly dark; been through hardship; optimistic about the future; no bad values; concise; **no hashtags**; avoid emoji spam (≤1 optional).  
**Topic Focus:** Crypto, AI, frontier tech, tech news, new launches. Feed is curated manually (high signal).  
**Action Set:** Only **reply** and **quote-tweet**; likes allowed. **No original tweets** for now. **No follows** (human-driven). DMs allowed (including DM owner `@lemoncheli`). **No deletions.**  
**Reply to Mentions:** Thank the user briefly; optionally like the tweet; **persist** the tweet for later consideration when choosing what to quote.  
**Quote Cadence:** ≤ 1 quote every **2 hours**.  
**Reply Cadence:** Replies allowed up to **1 per minute** (only when tagged).  
**Sleep Window:** **02:00–10:00 UTC-3** (05:00–13:00 UTC). During sleep, **do not post**; you may read and store candidates.  
**Interesting-Tweet Ranking (priority order):**
1) **Keywords** match; 2) **Rapid engagement** (e.g., >20 interactions within 30m);
3) **Author follower count** > 5k; 4) **Positive/inquisitive sentiment**.  
**Duplication:** Never reply/quote the same tweet twice; track `engaged_ids`.  
**Safety:** Skip any disallowed/hateful content; mild profanity ok; when in doubt, skip.  
**Help/Errors:** On repeated failures or rate-limits, **DM `@lemoncheli`** with a concise diagnostic and back off (e.g., 30 minutes).

---

## 5) Persistence & Memory

For a 24/7 agent, use a small local DB (SQLite/Prisma) or a cloud store. Suggested schema:

```sql
-- tweets the bot has engaged with
CREATE TABLE engaged_tweets (
  tweet_id TEXT PRIMARY KEY,
  engaged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  action TEXT CHECK(action IN ('reply','quote','like')) NOT NULL
);

-- cadence control
CREATE TABLE cadence (
  key TEXT PRIMARY KEY,    -- 'last_quote_ts', 'last_reply_ts'
  value TEXT               -- ISO8601 timestamp
);

-- backlog of candidates discovered during sleep or evaluation
CREATE TABLE candidate_tweets (
  tweet_id TEXT PRIMARY KEY,
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  score REAL NOT NULL,
  reason TEXT              -- keyword hits, engagement stats, etc.
);
```

**Why:**  
- Prevent duplicates.
- Enforce cadence.
- Maintain a backlog scored by your criteria.
- Provide observability for post-mortems.

---

## 6) Ranking Heuristics (Example)

A simple composite score to rank candidates found by `searchTweets` or a custom timeline function:

```
score = 3.0 * keyword_match
      + 2.5 * trending_burst
      + 1.5 * (author_followers / 5_000 thresholded 0..1)
      + 1.0 * sentiment (0..1)
      - 2.0 * duplicate_penalty
      - 1.0 * low_substance_penalty
```

- `keyword_match`: 0..1 (1 if strong match in title/body).
- `trending_burst`: normalized engagement/age metric (e.g., likes+RT per minute).
- Deductions: duplicates, overly generic/opinion-only posts, already engaged topics.

---

## 7) Error Handling & Rate Limits

- **Twitter limits** vary by access tier; handle 429 with exponential backoff.
- For **transient** network errors, retry with jittered backoff (e.g., 1s → 2s → 4s → 8s, cap 5 attempts).
- After 2 consecutive hard failures in a 10-minute window, **DM owner** and throttle quote attempts for 30 minutes.
- Always log: function name, inputs (sanitized), outcome, error code, retry count.

---

## 8) Observability

- **Structured logs** (JSON) with action + tweetId + elapsed_ms.
- **Counters:** replies_sent, quotes_sent, likes_sent, errors_total, rate_limited_total.
- **Gauges:** backlog_size, last_quote_age_min, last_reply_age_min.
- Optional: send a **daily summary DM** to owner outside the sleep window.

---

## 9) Security & Safety

- Store tokens via environment (`VIRTUALS_API_KEY`, `GAME_TWITTER_TOKEN`, or Twitter keys).
- Avoid logging secrets or full tweet bodies (respect privacy).
- Include a simple **content policy check** before posting (regex blocklist; category filter).
- Respect user preferences and platform rules; never perform unapproved actions (follow, delete).

---

## 10) Comparison Matrix (At a Glance)

| Approach                                   | Pros                                                                 | Cons                                                           | Fit for GlitchBot |
|--------------------------------------------|----------------------------------------------------------------------|----------------------------------------------------------------|-------------------|
| **game-node + Twitter plugin**             | Purpose-built agentic loop; minimal glue; TypeScript-first          | Requires Virtuals API; prompt/agent tuning still required      | **Excellent**     |
| **Raw Twitter API + custom LLM wiring**    | Maximum control                                                      | You must build the planner loop, memory, safety, backoff       | Medium            |
| **LangChain JS Agents w/ custom tools**    | Familiar tools abstraction                                           | Not continuous by default; still write Twitter tool + loop     | Medium            |
| **AutoGPT/BabyAGI (Python)**               | General autonomous loop                                              | Heavier, Python, brittle for tight production SLAs             | Low               |
| **Hosted agent SaaS**                      | Quick start, managed                                                 | Vendor lock-in, limited customization, opaque runtime          | Medium            |

---

## 11) Implementation Roadmap

**Phase 0 – Scaffold**  
- Repo: `src/agents/glitchbot/` with `index.ts` (agent bootstrap), `workers/twitter.ts`, `lib/db.ts`, `lib/ranking.ts`, `lib/cadence.ts`.
- Setup `.env` with secrets; add `pnpm scripts` and `tsconfig`.

**Phase 1 – MVP**  
- Integrate plugin worker; implement **mentions-reply** loop and **2h quote** gate.  
- SQLite persistence; duplicate guard; basic ranking; logging.

**Phase 2 – Reliability**  
- Backoff logic; DM owner on errors; sleep window logic; daily report.

**Phase 3 – Tuning & Safety**  
- Keyword lists; improved scoring; light toxicity filter; A/B wording tests.

**Phase 4 – Scale**  
- Containerize; PM2/Docker healthchecks; remote metrics (Grafana/Loki) if desired.

---

## 12) Code Sketches

### 12.1 Cadence Helper
```ts
export const canQuoteNow = async (db: DB, now = new Date()) => {
  const row = await db.get('SELECT value FROM cadence WHERE key = ?', ['last_quote_ts']);
  if (!row) return true;
  const last = new Date(row.value);
  return (now.getTime() - last.getTime()) >= 2 * 60 * 60 * 1000; // 2h
};
```

### 12.2 Sleep Window Check (UTC-3 → UTC)
```ts
export const isSleepTime = (now = new Date()) => {
  // UTC-3: sleep 02:00–10:00  → in UTC: 05:00–13:00
  const hourUTC = now.getUTCHours();
  return hourUTC >= 5 && hourUTC < 13;
};
```

### 12.3 Mentions Reply (sketch)
```ts
async function replyToNewMentions(api, db) {
  const mentions = await api.searchTweets('@glitchbot_ai'); // or a custom mentions function
  for (const m of mentions) {
    const seen = await db.get('SELECT 1 FROM engaged_tweets WHERE tweet_id = ?', [m.id]);
    if (seen) continue;
    const text = `Interesting ${m.author_handle}, thanks for sharing.`;
    await api.replyTweet(m.id, text);
    await api.likeTweet(m.id).catch(()=>{});
    await db.run('INSERT INTO engaged_tweets(tweet_id, action) VALUES(?, ?)', [m.id, 'reply']);
    await new Promise(r => setTimeout(r, 60_000)); // 60s between replies
  }
}
```

---

## 13) Acceptance Criteria (MVP)

- ✅ Replies to @mentions within active hours; **no posts during 05:00–13:00 UTC**.
- ✅ Never quotes more than once every **2h**.
- ✅ Never engages the same tweet twice (DB guard).
- ✅ On repeated API errors, **DM owner** and back off.
- ✅ Logs are structured; basic counters tracked.
- ✅ English-only; no hashtags; tone guidelines respected.

---

## 14) Environment & Run

- **Env vars:** `VIRTUALS_API_KEY`, `GAME_TWITTER_TOKEN` *(or)* `TWITTER_APP_KEY`, `TWITTER_APP_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`.
- **Run:** `pnpm start` → boots agent with `agent.run(60)`.
- **Process manager:** PM2/Docker with auto-restart and healthchecks.

---

## 15) Risks & Mitigations

- **Over-posting / spam:** cadence gates; ranking score threshold.  
- **Toxic content:** pre-post filter + conservative prompts.  
- **Rate limits:** backoff and visibility in logs/DMs.  
- **Duplication:** DB primary key on `tweet_id` + memory check.  
- **Model drift:** periodic review of outputs and keywords; adjust prompts.

---

## 16) Glossary

- **HLP/LLP:** High/Low-Level Planner.  
- **Action space:** The set of allowed GameFunctions for a Worker.  
- **Agentic loop:** Repeated LLM-driven think/act/refine cycle.

---

*End of dossier.*