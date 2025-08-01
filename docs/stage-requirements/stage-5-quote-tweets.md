# Stage 5 – Quote-Tweets

**Guards (apply before POST):**
- Not sleeping (respect UTC-3 02:00–10:00).
- `canQuoteNow()` = true (≥ 2h since last quote).
- Tweet ID not present in `engaged_tweets`.

**Post:**
```ts
await twitterClient.v2.tweet({
  text: commentary,                // <= 280 chars
  quote_tweet_id: targetTweetId,
});
```

**After:**
- Insert into `engaged_tweets` with action='quote'.
- Update `last_quote_ts` in `cadence`.
- Optionally like the original tweet.
