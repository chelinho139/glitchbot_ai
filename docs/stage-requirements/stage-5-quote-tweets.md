# Stage 5: Quote Tweet Functionality

## Goal

Implement quote tweet functionality with scoring/ranking system and create `quoteTweet` GameFunction for the G.A.M.E engine.

## Requirements

### 1. Quote Tweet Implementation

- [ ] Use `v2.quoteTweet()` method from game-twitter-node
- [ ] Create `quoteTweet` GameFunction
- [ ] Implement proper error handling
- [ ] Support custom commentary

### 2. Tweet Scoring System

- [ ] Implement scoring algorithm from requirements
- [ ] Score based on keywords, engagement, author followers
- [ ] Filter out low-quality content
- [ ] Prioritize high-value tweets

### 3. Scoring Criteria (Priority Order)

1. **Keywords** (crypto, AI, robotics, biotech, zero-knowledge, scaling, etc.)
2. **Rapid engagement** (likes + retweets > 20 in ≤ 30 min)
3. **Author followers** > 5,000
4. **Positive/inquisitive sentiment**

### 4. Quote Tweet GameFunction

```typescript
const quoteTweet = new GameFunction({
  name: "quoteTweet",
  description: "Quote tweet with custom commentary",
  args: [
    { name: "tweetId", description: "The tweet ID to quote" },
    { name: "commentary", description: "Custom commentary for the quote" },
  ] as const,
  executable: async (args, logger) => {
    // Implementation here
  },
});
```

### 5. Scoring Implementation

```typescript
interface TweetScore {
  tweetId: string;
  score: number;
  reasons: string[];
  author: {
    username: string;
    followers_count: number;
  };
  metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
}
```

### 6. Content Filtering

- [ ] Skip toxic/hateful content
- [ ] Filter out retweets
- [ ] Skip already engaged tweets
- [ ] Respect content policies

## Testing Criteria

### ✅ Success Criteria

- [ ] Can post quote tweets successfully
- [ ] Scoring algorithm works correctly
- [ ] Content filtering works
- [ ] Duplicate prevention works
- [ ] Error handling is robust

### 🧪 Test Commands

```bash
# Test quote tweet functionality
npm run test-quote

# Test scoring algorithm
npm run test-scoring

# Test content filtering
npm run test-filtering
```

### 📋 Test Requirements

The quote tweet test should:

- [ ] Test quote tweet posting
- [ ] Verify scoring algorithm
- [ ] Test content filtering
- [ ] Check duplicate prevention
- [ ] Handle rate limiting
- [ ] Test error scenarios

## Deliverables

- ✅ `quoteTweet` GameFunction
- ✅ Tweet scoring algorithm
- ✅ Content filtering system
- ✅ Test scripts for quote functionality
- ✅ Scoring documentation

## Implementation Details

### Quote Tweet API Call

```typescript
const result = await twitterClient.v2.quoteTweet({
  text: commentary,
  quote_tweet_id: tweetId,
});
```

### Scoring Algorithm

```typescript
function scoreTweet(tweet: TimelineTweet): number {
  let score = 0;

  // Keyword scoring
  score += calculateKeywordScore(tweet.text);

  // Engagement scoring
  score += calculateEngagementScore(tweet.metrics);

  // Author scoring
  score += calculateAuthorScore(tweet.author);

  // Sentiment scoring
  score += calculateSentimentScore(tweet.text);

  return score;
}
```

### Content Filtering

- [ ] Check for toxic keywords
- [ ] Verify tweet is not a retweet
- [ ] Check if already engaged
- [ ] Validate content length
- [ ] Ensure proper formatting

## Notes

- Respect Twitter's character limits
- Handle rate limiting appropriately
- Implement proper error handling
- Test with real tweets
- Consider engagement metrics

## Next Stage

After completing Stage 5, proceed to [Stage 6: Reply Functionality](stage-6-replies.md)
