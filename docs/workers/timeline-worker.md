# 🧵 Timeline Worker - Home Timeline, Suggestions Mix, and Quoting

**Priority**: HIGH
**Location**: `src/workers/timeline-worker.ts`

## ✅ Current Implementation

- `get_timeline`: Fetches home timeline (recommended feed) using `twitterClient.v2.homeTimeline`, with includes for users and referenced tweets. Excludes self-authored tweets if `BOT_TWITTER_USERNAME`/`SELF_TWITTER_USERNAME` is set. Tracks `last_newest_id` and pagination token in `timeline_state`.
- `get_timeline_with_suggestion`: Fetches timeline and mixes up to 2 recent suggested tweets discovered via mentions in the last 10 hours using `lib/suggestions.fetchRecentSuggestedAsTimelineTweets`. Dedupe and sort by `created_at`.
- `quote_tweet`: Posts a quote tweet by composing `comment + https://x.com/{username}/status/{tweet_id}`. Enforces 280-char limit, prevents duplicates via `engaged_quotes`, and enforces 1-hour cadence via `cadence` helpers. Uses rate-limited client.

## Topic Guard

Enforced in the worker description: Only AI, crypto, software, and tech content is to be processed. Reject non-tech topics.

## Cadence & Duplication

- Cadence: 1 hour between quote tweets (`cadence.last_quote_ts`).
- Duplicate prevention: `engaged_quotes` table stores quoted tweet IDs.

## Configuration

- Env: `GAME_TWITTER_TOKEN`, optional `BOT_TWITTER_USERNAME`/`SELF_TWITTER_USERNAME`.
- Rate limiting: transparent proxy with per-endpoint dev defaults (~1 req/min) in `src/persistence/global/rate-limiter.ts`.

## Future Enhancements

- Integrate `lib/ranking.ts` scoring to pick best timeline/suggestion candidate automatically.
- Add author credibility and engagement velocity filters prior to quoting.
