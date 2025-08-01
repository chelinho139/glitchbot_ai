# Stage 3 – Timeline Fetch (feature-detect + fallback)

**Goal:** Prefer a home timeline. If unavailable, aggregate a home-like feed from followees.

## A) Prefer home timeline (if exposed by client)
```ts
// pseudo: use only if supported by the client
if (typeof twitterClient.v2.homeTimeline === "function") {
  const tl = await twitterClient.v2.homeTimeline({ max_results: 100 });
  const tweets = tl?.data ?? [];
  // map + normalize to your internal type
}
```

## B) Fallback: Aggregate from followees
```ts
const me = await twitterClient.v2.me();
const uid = me.data.id;

// 1) collect followees (cache this list; sample N for each cycle)
const followees = await twitterClient.v2.following(uid, { asPaginator: true });

// 2) pick a sample of followees (e.g., 50) and fetch recent tweets per user
const sample = followees.users.slice(0, 50);
const chunks = await Promise.all(sample.map(u => twitterClient.v2.userTimeline(u.id, { max_results: 5 })));

// 3) merge, de-dup, and sort by recency & engagement
const candidates = chunks.flatMap(c => c.data || []);
// add derived metrics (likes/retweets if available); then rank downstream
```

**Return a normalized list** with fields you’ll score on later (engagement velocity, follower count, keywords, etc.).
