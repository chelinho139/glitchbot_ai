# Stage 6 – Replies

**Source:** Prefer **mentions timeline**; fall back to search if unavailable.

```ts
// mentions timeline preferred
// const { data: mentions } = await twitterClient.v2.userMentionTimeline(selfId, { since_id, max_results: 50 });

// fallback: search by handle (more noisy)
const { data: mentions } = await twitterClient.v2.search(`@glitchbot_ai -is:retweet`, { max_results: 50 });

for (const m of mentions ?? []) {
  const exists = await db.get('SELECT 1 FROM engaged_tweets WHERE tweet_id=?', [m.id]);
  if (exists) continue;
  // cadence: ensure ≥60s since last reply
  await twitterClient.v2.tweet({
    text: composeReply(m), // e.g., "Interesting @handle, thanks for sharing."
    reply: { in_reply_to_tweet_id: m.id },
  });
  await db.run('INSERT INTO engaged_tweets(tweet_id, action) VALUES(?, ?)', [m.id, 'reply']);
  // wait 60s between replies
}
```
