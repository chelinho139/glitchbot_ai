# GlitchBot — Cursor LLM Build Instructions (Node.js + TypeScript)

> **READ THESE FIRST (MANDATORY)**
>
> 1. `/src/docs/overview_game_node_glitchbot_research.md` — the complete research dossier for architecture, flows, cadence, persistence, and error handling. **You must follow it.**
> 2. **SDK Docs:** https://github.com/game-by-virtuals/game-node — read the README and examples. **The implementation MUST use the Virtuals G.A.M.E engine (`@virtuals-protocol/game`).** Do **not** substitute other agent frameworks.
> 3. **Bot Prompt:** `/src/docs/glitchbot_prompt.md` — this is the **single source of truth** for GlitchBot's persona, goals, constraints, and examples. **Use this exact prompt** for the Agent/Worker models.
> 4. **Twitter Node:** https://github.com/game-by-virtuals/game-twitter-node — **Use this simpler module** for Twitter API access instead of the complex plugin.

**Goal:** Ship a production Twitter/X agent (GlitchBot) using the **Virtuals G.A.M.E engine** and the **simpler game-twitter-node module**.

**LLM role:** You are the coding assistant inside Cursor. Follow these instructions precisely, generate code and diffs, and ask for missing secrets if needed.

---

## 1) Non-Negotiables

- ✅ **Use the G.A.M.E engine** (`@virtuals-protocol/game`) for the agent loop (HLP/LLP). Do **not** implement a custom planner or use LangChain/AutoGPT/etc.
- ✅ **Use the simpler game-twitter-node** (`@virtuals-protocol/game-twitter-node`) for Twitter API access. Do **not** use the complex Twitter plugin.
- ✅ **Use TIMELINE instead of SEARCH** - Fetch from home timeline which already includes smart people being followed and good algorithm.
- ✅ **Use the bot prompt from** `/src/docs/glitchbot_prompt.md`. Do **not** invent a new prompt.
- ✅ Conform to the design and behavior in `/src/docs/overview_game_node_glitchbot_research.md`.
- ✅ **Implement in STAGES with testing** - Each stage must be tested before moving to the next.

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
5. **Content Discovery:** **Use HOME TIMELINE** - Fetch from timeline which already includes smart people being followed and good algorithm. Do **not** use search.
6. **Interesting Tweet Criteria (priority):** keywords → rapid engagement → author followers > 5k → positive/inquisitive sentiment.
7. **Persistence:** Local DB for engaged IDs, cadence timestamps, and candidate backlog.
8. **Safety:** Skip toxic/hateful content; mild profanity allowed; when in doubt, skip.
9. **Errors:** On repeated failures or rate-limits, DM owner with a short diagnostic and back off 30 minutes.

---

## 3) Repository Layout

```
/src
  /agents/glitchbot
    index.ts            # bootstrap + run loop (G.A.M.E engine)
    workers.twitter.ts  # Twitter worker setup with game-twitter-node
    prompts.ts          # load prompt text from /src/docs/glitchbot_prompt.md
  /lib
    db.ts               # SQLite wrapper (better-sqlite3)
    ranking.ts          # scoring functions per requirements
    cadence.ts          # sleep window + cadence guards
    log.ts              # structured logger
/docs
  overview_game_node_glitchbot_research.md
  glitchbot_prompt.md
  cursor_build_instructions.md   # this file
  stage-requirements/            # individual stage requirements
    stage-1-setup.md
    stage-2-twitter-auth.md
    stage-3-timeline-fetch.md
    stage-4-database.md
    stage-5-quote-tweets.md
    stage-6-replies.md
    stage-7-integration.md
```

---

## 4) Dependencies

- Runtime: Node 20+, TypeScript
- Packages:
  - `@virtuals-protocol/game` **← REQUIRED (G.A.M.E engine)**
  - `@virtuals-protocol/game-twitter-node` **← REQUIRED (simpler Twitter module)**
  - `zod` (if needed for arg validation)
  - `better-sqlite3`
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

## 6) Implementation Stages (MANDATORY - Test Each Stage)

### **STAGE 1: Project Setup & Dependencies**

**File:** `docs/stage-requirements/stage-1-setup.md`

- Initialize TypeScript project
- Install dependencies
- Set up basic project structure
- Create `.env` template
- **TEST:** `npm run build` should work without errors

### **STAGE 2: Twitter Authentication**

**File:** `docs/stage-requirements/stage-2-twitter-auth.md`

- Implement Twitter client using `@virtuals-protocol/game-twitter-node`
- Test authentication with both auth modes
- Create simple test script
- **TEST:** `npm run test-twitter` should authenticate successfully

### **STAGE 3: Timeline Fetching**

**File:** `docs/stage-requirements/stage-3-timeline-fetch.md`

- Implement home timeline fetching (NOT search)
- Create `fetchHomeTimeline` GameFunction
- Test timeline data structure
- **TEST:** Should fetch 20+ tweets from home timeline with user info

### **STAGE 4: Database Implementation**

**File:** `docs/stage-requirements/stage-4-database.md`

- Implement SQLite database with tables
- Create memory functions (`storeMemory`, `fetchMemory`)
- Test database operations
- **TEST:** Should store/retrieve data without errors

### **STAGE 5: Quote Tweet Functionality**

**File:** `docs/stage-requirements/stage-5-quote-tweets.md`

- Implement `quoteTweet` GameFunction
- Add tweet scoring/ranking
- Test quote tweet posting
- **TEST:** Should post quote tweets successfully

### **STAGE 6: Reply Functionality**

**File:** `docs/stage-requirements/stage-6-replies.md`

- Implement `replyTweet` GameFunction
- Add mention detection
- Test reply posting
- **TEST:** Should reply to mentions successfully

### **STAGE 7: Full Integration**

**File:** `docs/stage-requirements/stage-7-integration.md`

- Integrate all components with G.A.M.E engine
- Add cadence controls and sleep window
- Implement error handling
- **TEST:** Full bot should run without crashes

---

## 7) Key Implementation Details

### **Twitter Client Setup (Stage 2)**

```ts
import { TwitterApi } from "@virtuals-protocol/game-twitter-node";

// For Virtuals token
const twitterClient = new TwitterApi({
  gameTwitterAccessToken: process.env.GAME_TWITTER_TOKEN,
});

// For native Twitter credentials
const twitterClient = new TwitterApi({
  apiKey: process.env.TWITTER_APP_KEY,
  apiSecretKey: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessTokenSecret: process.env.TWITTER_ACCESS_SECRET,
});
```

### **Timeline Fetching (Stage 3)**

```ts
// Fetch from HOME TIMELINE (not search)
const timeline = await twitterClient.v2.homeTimeline({
  max_results: 20,
  "tweet.fields": "created_at,author_id,public_metrics,text",
  "user.fields": "username,name,public_metrics",
  expansions: "author_id",
});
```

### **GameFunction Structure**

```ts
const fetchHomeTimeline = new GameFunction({
  name: "fetchHomeTimeline",
  description: "Fetch tweets from home timeline to find interesting content",
  args: [{ name: "limit", description: "Number of tweets to fetch" }] as const,
  executable: async (args, logger) => {
    // Implementation here
  },
});
```

---

## 8) Testing Requirements

### **Each Stage Must Include:**

1. **Unit Tests** - Test individual functions
2. **Integration Tests** - Test component interactions
3. **Manual Tests** - Verify actual Twitter API calls
4. **Error Tests** - Test error handling

### **Test Commands:**

```bash
# Stage 1
npm run build

# Stage 2
npm run test-twitter

# Stage 3
npm run test-timeline

# Stage 4
npm run test-db

# Stage 5
npm run test-quote

# Stage 6
npm run test-reply

# Stage 7
npm start
```

---

## 9) Deliverables (Definition of Done)

### **Per Stage:**

- ✅ Source code for that stage
- ✅ Tests passing
- ✅ Documentation updated
- ✅ No TypeScript errors
- ✅ Manual testing completed

### **Final Deliverables:**

- ✅ Source under `/src` with all modules
- ✅ SQLite database with proper schema
- ✅ `.env.example` with all required variables
- ✅ Working `npm start` that launches the G.A.M.E agent
- ✅ All stages tested and working
- ✅ Bot respects sleep window (05:00–13:00 UTC)
- ✅ Bot uses home timeline (not search)
- ✅ Bot follows cadence rules
- ✅ Error handling and DM alerts working

---

## 10) Notes to Cursor

- **Follow stages exactly** - Do not skip stages or combine them
- **Test each stage** before moving to the next
- **Use home timeline** - The timeline already includes smart people and good algorithm
- **Use game-twitter-node** - Simpler module, not the complex plugin
- **Ask for missing context** if needed
- **Propose diffs** rather than full rewrites
- **Do not add unapproved capabilities** (follow/delete/original tweets)

---

_End of build instructions._
