# Stage 3: Timeline Fetching

## Goal

Implement home timeline fetching using `@virtuals-protocol/game-twitter-node` and create a `fetchHomeTimeline` GameFunction for the G.A.M.E engine.

## Requirements

### 1. Home Timeline Implementation

- [ ] Use `v2.homeTimeline()` method (NOT search)
- [ ] Fetch tweets from the home timeline/feed
- [ ] Include user information and metrics
- [ ] Format data for scoring and processing

### 2. Timeline Data Structure

```typescript
interface TimelineTweet {
  id: string;
  text: string;
  created_at: string;
  author: {
    id: string;
    username: string;
    name: string;
    followers_count: number;
  } | null;
  metrics: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
}
```

### 3. GameFunction Implementation

- [ ] Create `fetchHomeTimeline` GameFunction
- [ ] Accept `limit` parameter (default: 20)
- [ ] Return formatted timeline data
- [ ] Handle errors gracefully

### 4. Timeline Fetching Code

```typescript
const timeline = await twitterClient.v2.homeTimeline({
  max_results: limit,
  "tweet.fields": "created_at,author_id,public_metrics,text",
  "user.fields": "username,name,public_metrics",
  expansions: "author_id",
});
```

### 5. Data Processing

- [ ] Map tweets to internal format
- [ ] Include user information
- [ ] Calculate engagement metrics
- [ ] Filter out retweets if needed
- [ ] Sort by relevance/engagement

## Testing Criteria

### ✅ Success Criteria

- [ ] Can fetch 20+ tweets from home timeline
- [ ] User information is included
- [ ] Engagement metrics are available
- [ ] Data structure is consistent
- [ ] GameFunction works with G.A.M.E engine

### 🧪 Test Commands

```bash
# Test timeline fetching
npm run test-timeline

# Test with different limits
npm run test-timeline -- --limit 10
npm run test-timeline -- --limit 50
```

### 📋 Test Requirements

The timeline test should:

- [ ] Fetch tweets from home timeline
- [ ] Display tweet count
- [ ] Show sample tweet data
- [ ] Verify user information
- [ ] Check engagement metrics
- [ ] Handle rate limiting

## Deliverables

- ✅ `fetchHomeTimeline` GameFunction
- ✅ Timeline data processing
- ✅ Test script for timeline fetching
- ✅ Proper error handling
- ✅ Data structure documentation

## Implementation Details

### GameFunction Structure

```typescript
const fetchHomeTimeline = new GameFunction({
  name: "fetchHomeTimeline",
  description: "Fetch tweets from home timeline to find interesting content",
  args: [
    { name: "limit", description: "Number of tweets to fetch (default: 20)" },
  ] as const,
  executable: async (args, logger) => {
    // Implementation here
  },
});
```

### Timeline Processing

- [ ] Fetch raw timeline data
- [ ] Extract user information
- [ ] Calculate engagement scores
- [ ] Filter and sort tweets
- [ ] Return formatted results

## Notes

- **Use home timeline, NOT search** - Timeline already includes smart people and good algorithm
- Handle rate limiting appropriately
- Include proper error handling
- Test with real timeline data
- Consider engagement metrics for scoring

## Next Stage

After completing Stage 3, proceed to [Stage 4: Database Implementation](stage-4-database.md)
