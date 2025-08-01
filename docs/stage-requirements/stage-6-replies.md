# Stage 6: Reply Functionality

## Goal

Implement reply functionality with mention detection and create `replyTweet` GameFunction for the G.A.M.E engine.

## Requirements

### 1. Reply Tweet Implementation

- [ ] Use `v2.replyTweet()` method from game-twitter-node
- [ ] Create `replyTweet` GameFunction
- [ ] Implement proper error handling
- [ ] Support custom reply text

### 2. Mention Detection

- [ ] Detect mentions of `@glitchbot_ai`
- [ ] Filter out already replied mentions
- [ ] Track mention history
- [ ] Handle multiple mentions

### 3. Reply Generation

- [ ] Generate appropriate reply text
- [ ] Thank user by handle
- [ ] Keep replies brief (<20 words)
- [ ] Maintain bot personality

### 4. Reply Tweet GameFunction

```typescript
const replyTweet = new GameFunction({
  name: "replyTweet",
  description: "Reply to a tweet",
  args: [
    { name: "tweetId", description: "The tweet ID to reply to" },
    { name: "replyText", description: "The reply text" },
  ] as const,
  executable: async (args, logger) => {
    // Implementation here
  },
});
```

### 5. Mention Processing

```typescript
interface Mention {
  tweetId: string;
  authorUsername: string;
  authorName: string;
  tweetText: string;
  createdAt: string;
  isReplied: boolean;
}
```

### 6. Reply Generation Logic

- [ ] Extract user handle from mention
- [ ] Generate appropriate response
- [ ] Check for duplicate replies
- [ ] Respect reply cadence (≥60s between replies)

## Testing Criteria

### ✅ Success Criteria

- [ ] Can post replies successfully
- [ ] Mention detection works
- [ ] Reply generation is appropriate
- [ ] Duplicate prevention works
- [ ] Cadence control works

### 🧪 Test Commands

```bash
# Test reply functionality
npm run test-reply

# Test mention detection
npm run test-mentions

# Test reply generation
npm run test-reply-gen
```

### 📋 Test Requirements

The reply test should:

- [ ] Test reply tweet posting
- [ ] Verify mention detection
- [ ] Test reply generation
- [ ] Check duplicate prevention
- [ ] Handle rate limiting
- [ ] Test cadence control

## Deliverables

- ✅ `replyTweet` GameFunction
- ✅ Mention detection system
- ✅ Reply generation logic
- ✅ Test scripts for reply functionality
- ✅ Cadence control implementation

## Implementation Details

### Reply Tweet API Call

```typescript
const result = await twitterClient.v2.replyTweet({
  text: replyText,
  reply_to_tweet_id: tweetId,
});
```

### Mention Detection

```typescript
async function detectMentions(): Promise<Mention[]> {
  // Search for mentions of @glitchbot_ai
  const mentions = await twitterClient.v2.search({
    query: "@glitchbot_ai",
    max_results: 10,
  });

  // Filter and process mentions
  return processMentions(mentions.data);
}
```

### Reply Generation

```typescript
function generateReply(mention: Mention): string {
  const username = mention.authorUsername;

  // Generate appropriate reply based on content
  if (mention.tweetText.includes("check this out")) {
    return `Interesting @${username}, thanks for sharing.`;
  }

  return `Thanks @${username}!`;
}
```

### Cadence Control

- [ ] Track last reply timestamp
- [ ] Enforce 60-second minimum between replies
- [ ] Store cadence data in database
- [ ] Handle multiple mentions properly

## Notes

- Respect Twitter's character limits
- Handle rate limiting appropriately
- Implement proper error handling
- Test with real mentions
- Maintain bot personality

## Next Stage

After completing Stage 6, proceed to [Stage 7: Full Integration](stage-7-integration.md)
