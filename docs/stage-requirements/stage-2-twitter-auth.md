# Stage 2 – Twitter Auth (game-twitter-node)

## Auth Modes

### A) Virtuals single-token
Set in `.env`:
```
VIRTUALS_API_KEY=...
GAME_TWITTER_TOKEN=...
```
Instantiate:
```ts
import { TwitterApi } from "@virtuals-protocol/game-twitter-node";

export const twitterClient = new TwitterApi({
  accessToken: process.env.GAME_TWITTER_TOKEN!,
});
```

### B) Native app keys
Set in `.env`:
```
VIRTUALS_API_KEY=...
TWITTER_APP_KEY=...
TWITTER_APP_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...
```
Instantiate:
```ts
import { TwitterApi } from "@virtuals-protocol/game-twitter-node";

export const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY!,
  appSecret: process.env.TWITTER_APP_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessTokenSecret: process.env.TWITTER_ACCESS_SECRET!,
});
```

## Quick Sanity Check
```ts
const me = await twitterClient.v2.me();
console.log("Authed as:", me.data?.username || me.data?.id);
```
