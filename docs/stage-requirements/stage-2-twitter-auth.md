# Stage 2: Twitter Authentication

## Goal

Implement Twitter authentication using `@virtuals-protocol/game-twitter-node` and test both authentication modes.

## Requirements

### 1. Twitter Client Implementation

- [ ] Import `TwitterApi` from `@virtuals-protocol/game-twitter-node`
- [ ] Implement authentication for Virtuals token mode
- [ ] Implement authentication for native Twitter credentials mode
- [ ] Create environment variable validation

### 2. Authentication Modes

#### Virtuals Token Mode

```typescript
import { TwitterApi } from "@virtuals-protocol/game-twitter-node";

const twitterClient = new TwitterApi({
  gameTwitterAccessToken: process.env.GAME_TWITTER_TOKEN,
});
```

#### Native Twitter Credentials Mode

```typescript
const twitterClient = new TwitterApi({
  apiKey: process.env.TWITTER_APP_KEY,
  apiSecretKey: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessTokenSecret: process.env.TWITTER_ACCESS_SECRET,
});
```

### 3. Environment Configuration

- [ ] Create `src/config/environment.ts`
- [ ] Implement Zod schema validation
- [ ] Support both authentication modes
- [ ] Validate required environment variables

### 4. Test Script Creation

- [ ] Create `src/test-twitter.ts`
- [ ] Test both authentication modes
- [ ] Verify API access
- [ ] Test basic Twitter API calls

### 5. Error Handling

- [ ] Handle authentication failures
- [ ] Provide clear error messages
- [ ] Support fallback authentication modes

## Testing Criteria

### ✅ Success Criteria

- [ ] Both authentication modes work
- [ ] Twitter API client can be instantiated
- [ ] Basic API calls succeed
- [ ] Environment variables are validated
- [ ] Error handling works properly

### 🧪 Test Commands

```bash
# Test Virtuals token mode
GAME_TWITTER_TOKEN=your_token npm run test-twitter

# Test native credentials mode
TWITTER_APP_KEY=your_key TWITTER_APP_SECRET=your_secret TWITTER_ACCESS_TOKEN=your_token TWITTER_ACCESS_SECRET=your_secret npm run test-twitter

# Test environment validation
npm run test-env
```

### 📋 Test Script Requirements

The test script should:

- [ ] Load environment variables
- [ ] Create Twitter client
- [ ] Test `v2.me()` to get user profile
- [ ] Test `v2.homeTimeline()` to verify timeline access
- [ ] Display authentication status
- [ ] Handle errors gracefully

## Deliverables

- ✅ Twitter client implementation
- ✅ Environment configuration with validation
- ✅ Test script (`src/test-twitter.ts`)
- ✅ Both authentication modes working
- ✅ Error handling implemented
- ✅ Clear documentation for setup

## Environment Variables

```bash
# Virtuals token mode
VIRTUALS_API_KEY=apt-xxxxxxxxxx
GAME_TWITTER_TOKEN=apx-xxxxxxxxxx

# OR native Twitter credentials mode
VIRTUALS_API_KEY=apt-xxxxxxxxxx
TWITTER_APP_KEY=your_api_key
TWITTER_APP_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_token_secret
```

## Notes

- Use the simpler `game-twitter-node` module as specified
- Support both authentication modes for flexibility
- Provide clear error messages for debugging
- Test with real credentials (not mocked)

## Next Stage

After completing Stage 2, proceed to [Stage 3: Timeline Fetching](stage-3-timeline-fetch.md)
