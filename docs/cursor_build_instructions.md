# GlitchBot — Cursor LLM Build Instructions (Node.js + TypeScript)

> **READ THESE FIRST (MANDATORY)**
>
> 1) `/src/docs/overview_game_node_glitchbot_research.md` — the complete research dossier for architecture, flows, cadence, persistence, and error handling. **You must follow it.**
> 2) **SDK Docs:** https://github.com/game-by-virtuals/game-node — read the README and examples. **The implementation MUST use the Virtuals G.A.M.E engine (`@virtuals-protocol/game`).** Do **not** substitute other agent frameworks.
> 3) **Bot Prompt:** `/src/docs/glitchbot_prompt.md` — this is the **single source of truth** for GlitchBot’s persona, goals, constraints, and examples. **Use this exact prompt** for the Agent/Worker models.

**Goal:** Ship a production Twitter/X agent (GlitchBot) using the **Virtuals G.A.M.E engine** and the **official Twitter plugin**.

**LLM role:** You are the coding assistant inside Cursor. Follow these instructions precisely, generate code and diffs, and ask for missing secrets if needed.

---

## 1) Non-Negotiables

- ✅ **Use the G.A.M.E engine** (`@virtuals-protocol/game`) for the agent loop (HLP/LLP). Do **not** implement a custom planner or use LangChain/AutoGPT/etc.
- ✅ **Use the official Twitter plugin** (`@virtuals-protocol/game-twitter-plugin`) for actions.
- ✅ **Use the bot prompt from** `/src/docs/glitchbot_prompt.md`. Do **not** invent a new prompt.
- ✅ Conform to the design and behavior in `/src/docs/overview_game_node_glitchbot_research.md`.

---

## 2) Functional Requirements

1. **Actions permitted:** reply to mentions, quote-tweet high-signal posts, like tweets.  
   - No original tweets; no follows; no deletions.  
   - May send DMs to owner `@lemoncheli` for help or alerts.
2. **Language & Style:** English-only; friendly, techy, slightly dark; no hashtags; ≤1 emoji optional.
3. **Cadence & Timing:** (enforce per research dossier)
   - Quote-tweets at most **once every 2 hours**.
   - Replies to mentions: at most **one per minute**.
   - **Sleep** between **02:00–10:00 UTC-3** (05:00–13:00 UTC). No posting in this window.
4. **Topic Focus:** crypto, AI, frontier tech, tech news, notable launches (curated feed).
5. **Interesting Tweet Criteria (priority):** keywords → rapid engagement → author followers > 5k → positive/inquisitive sentiment.
6. **Persistence:** Local DB for engaged IDs, cadence timestamps, and candidate backlog.
7. **Safety:** Skip toxic/hateful content; mild profanity allowed; when in doubt, skip.
8. **Errors:** On repeated failures or rate-limits, DM owner with a short diagnostic and back off 30 minutes.

---

## 3) Repository Layout

```
/src
  /agents/glitchbot
    index.ts            # bootstrap + run loop (G.A.M.E engine)
    workers.twitter.ts  # Twitter worker setup, custom GameFunctions if needed
    prompts.ts          # load prompt text from /src/docs/glitchbot_prompt.md if embedded
  /lib
    db.ts               # SQLite wrapper (better-sqlite3 or Prisma)
    ranking.ts          # scoring functions per requirements
    cadence.ts          # sleep window + cadence guards
    log.ts              # structured logger
/docs
  overview_game_node_glitchbot_research.md
  glitchbot_prompt.md
  cursor_build_instructions.md   # this file
```

---

## 4) Dependencies

- Runtime: Node 20+, TypeScript
- Packages:
  - `@virtuals-protocol/game`   **← REQUIRED (G.A.M.E engine)**
  - `@virtuals-protocol/game-twitter-plugin`
  - `zod` (if needed for arg validation)
  - `better-sqlite3` *(or)* `prisma` + `@prisma/client`
  - `dotenv`
  - `pino` (logger)  
- Process: `pm2` (optional) or Docker

---

## 5) Environment Variables

One of the following auth modes:

- **Virtuals token mode**
  - `VIRTUALS_API_KEY`
  - `GAME_TWITTER_TOKEN`
- **Twitter app mode**
  - `VIRTUALS_API_KEY`
  - `TWITTER_APP_KEY`
  - `TWITTER_APP_SECRET`
  - `TWITTER_ACCESS_TOKEN`
  - `TWITTER_ACCESS_SECRET`

Do **not** commit secrets.

---

## 6) Implementation Steps (follow the dossier + SDK docs)

1. **Scaffold Project**
   - Initialize TS config, `pnpm` scripts, `.env` loading, and logger.
   - Create `lib/db.ts` (SQLite). Create tables: `engaged_tweets`, `cadence`, `candidate_tweets`.
   - Confirm you have read `/src/docs/overview_game_node_glitchbot_research.md` and the SDK README.

2. **Wire Twitter Worker (G.A.M.E)**
   - Create `workers.twitter.ts`: instantiate `GameTwitterClient`, then `new TwitterPlugin(...).getWorker()`.
   - If missing primitives, add **custom GameFunctions** (e.g., `fetchMentions`, `sendDM`).

3. **Agent Bootstrap (G.A.M.E)**  
   - In `index.ts`, construct `GameAgent` with:
     - `name: "GlitchBot"`
     - `goal` and `description` from `/src/docs/glitchbot_prompt.md`.
     - `workers: [twitterWorker]`.
   - `await agent.init()` then `await agent.run(60, { verbose: true })`.

4. **Cadence & Sleep Guards**
   - Implement `canQuoteNow`, `canReplyNow`, and `isSleepTime` in `cadence.ts`.
   - Before calling `quoteTweet` or `replyTweet`, enforce guards and update timestamps in `cadence` table.

5. **Mentions Reply Loop**
   - Search mentions (`searchTweets("@glitchbot_ai")` or a mentions endpoint).
   - For each unseen tweet: generate short acknowledgement; `replyTweet`; optional `likeTweet`; store `tweet_id` in `engaged_tweets`.
   - Wait ≥60s between replies.

6. **Quote-Tweet Loop**
   - If `canQuoteNow()` and not sleep time: discover candidates (timeline/keyword search).
   - Score with `ranking.ts` per criteria; skip low score; ensure not duplicate; `quoteTweet` best candidate; record `last_quote_ts` and add to `engaged_tweets`.

7. **Error Handling**
   - Catch 429 + transient errors; exponential backoff with jitter.
   - On repeated failures: `sendDM("lemoncheli", "Need assistance: <brief>")` then throttle for 30 minutes.

8. **Logging & Metrics**
   - Use `pino` structured logs.
   - Track counters: replies_sent, quotes_sent, likes_sent, rate_limited_total.
   - Optional: daily DM summary to owner outside sleep window.

9. **Tests (Lightweight)**
   - Unit test `isSleepTime`, cadence gates, and ranking function.
   - Dry-run mode: mock Twitter client; verify no duplicate engagements.

10. **Run & Ship**
    - `pnpm start` to launch the agent.
    - Optional: PM2 config or Dockerfile; healthcheck endpoint.

---

## 7) Key Code Sketches

*(See `/src/docs/overview_game_node_glitchbot_research.md` for additional sketches.)*

### Sleep Window (UTC-3 → UTC)
```ts
export const isSleepTime = (d = new Date()) => {
  const h = d.getUTCHours(); // UTC-3 sleep 02:00–10:00 -> UTC 05:00–13:00
  return h >= 5 && h < 13;
};
```

### Quote Cadence
```ts
export const canQuoteNow = async (db, now = new Date()) => {
  const r = await db.get('SELECT value FROM cadence WHERE key=?', ['last_quote_ts']);
  if (!r) return true;
  return (now.getTime() - new Date(r.value).getTime()) >= 2 * 60 * 60 * 1000;
};
```

### Mentions Reply
```ts
export async function handleMentions(api, db) {
  const results = await api.searchTweets('@glitchbot_ai'); // or plugin mentions
  for (const t of results) {
    const exists = await db.get('SELECT 1 FROM engaged_tweets WHERE tweet_id=?', [t.id]);
    if (exists) continue;
    const text = `Interesting ${t.author_handle}, thanks for sharing.`;
    await api.replyTweet(t.id, text);
    await api.likeTweet(t.id).catch(()=>{});
    await db.run('INSERT INTO engaged_tweets(tweet_id, action) VALUES(?, ?)', [t.id, 'reply']);
    await new Promise(r => setTimeout(r, 60_000));
  }
}
```

---

## 8) Deliverables (Definition of Done)

- Source under `/src` with modules above.
- SQLite migrations & seed scripts (or Prisma schema).
- `.env.example` documenting required variables.
- Working `pnpm start` that launches the **G.A.M.E** agent.
- Demonstrated behavior:
  - No posting during 05:00–13:00 UTC.
  - Replies to new mentions (≤1/min).
  - Quotes ≤1 per 2h with ranking and duplication guard.
  - On repeated errors, DM owner and back off.
- Logs show structured outputs and counters.

---

## 9) Notes to Cursor

- Read and adhere to `/src/docs/overview_game_node_glitchbot_research.md` and the SDK README at https://github.com/game-by-virtuals/game-node.
- Always use the **G.A.M.E engine** with `GameAgent` + `GameWorker` + `GameFunctions`.
- Use the **exact prompt** at `/src/docs/glitchbot_prompt.md`.
- Ask for any missing context (e.g., exact keyword list).
- Propose diffs rather than full rewrites; keep helpers small and testable.
- Do not add unapproved capabilities (follow/delete/original tweets).

---

*End of build instructions.*