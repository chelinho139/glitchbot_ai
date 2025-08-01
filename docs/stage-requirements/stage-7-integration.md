# Stage 7: Full Integration

## Goal

Integrate all components with the G.A.M.E engine, implement cadence controls, sleep window, and error handling for a production-ready bot.

## Requirements

### 1. G.A.M.E Engine Integration

- [ ] Create `GameAgent` with proper configuration
- [ ] Integrate all GameFunctions into `GameWorker`
- [ ] Set up agent state management
- [ ] Implement agent loop with proper intervals

### 2. Cadence Controls

- [ ] Implement sleep window (02:00-10:00 UTC-3)
- [ ] Enforce quote tweet cadence (≥120 min apart)
- [ ] Enforce reply cadence (≥60s between replies)
- [ ] Store cadence data in database

### 3. Sleep Window Implementation

```typescript
function isSleepTime(): boolean {
  const now = new Date();
  const hourUTC = now.getUTCHours();
  // UTC-3: sleep 02:00–10:00 → in UTC: 05:00–13:00
  return hourUTC >= 5 && hourUTC < 13;
}
```

### 4. Agent Configuration

```typescript
const agent = new GameAgent(env.VIRTUALS_API_KEY, {
  name: "GlitchBot",
  goal: "Surface and amplify noteworthy ideas in crypto, AI, frontier tech",
  description:
    "Tech-savvy AI bot that quotes interesting tweets and replies to mentions",
  workers: [twitterWorker],
  getAgentState: async () => ({
    stats: await db.getStats(),
    cadenceStatus: await getCadenceStatus(),
    isSleepTime: isSleepTime(),
  }),
});
```

### 5. Error Handling

- [ ] Handle Twitter API rate limits
- [ ] Implement exponential backoff
- [ ] Send DM alerts to owner on errors
- [ ] Graceful error recovery

### 6. Logging and Monitoring

- [ ] Structured logging with Pino
- [ ] Track metrics and statistics
- [ ] Monitor bot performance
- [ ] Log all actions and errors

### 7. Production Deployment

- [ ] PM2 configuration for process management
- [ ] Environment variable management
- [ ] Health check endpoints
- [ ] Graceful shutdown handling

## Testing Criteria

### ✅ Success Criteria

- [ ] Bot runs without crashes
- [ ] Sleep window is respected
- [ ] Cadence controls work
- [ ] Error handling is robust
- [ ] All GameFunctions work together

### 🧪 Test Commands

```bash
# Test full integration
npm start

# Test sleep window
npm run test-sleep

# Test cadence controls
npm run test-cadence

# Test error handling
npm run test-errors
```

### 📋 Test Requirements

The integration test should:

- [ ] Start the bot successfully
- [ ] Verify sleep window behavior
- [ ] Test cadence controls
- [ ] Handle errors gracefully
- [ ] Monitor performance
- [ ] Test all GameFunctions

## Deliverables

- ✅ Fully integrated G.A.M.E agent
- ✅ Cadence control system
- ✅ Sleep window implementation
- ✅ Error handling and recovery
- ✅ Production deployment configuration
- ✅ Monitoring and logging

## Implementation Details

### Agent Loop

```typescript
await agent.init();
await agent.run(60, { verbose: false }); // Run every 60 seconds
```

### Cadence Management

```typescript
async function canQuoteNow(): Promise<boolean> {
  const lastQuote = await db.getCadenceValue("last_quote_ts");
  if (!lastQuote) return true;

  const timeSince = Date.now() - new Date(lastQuote).getTime();
  return timeSince >= 2 * 60 * 60 * 1000; // 2 hours
}
```

### Error Recovery

```typescript
async function handleError(error: Error, context: string) {
  logger.error({ error, context }, "Bot error occurred");

  if (error.message.includes("rate limit")) {
    await sendDMToOwner(`Rate limited: ${context}`);
    // Implement backoff
  }
}
```

### Health Monitoring

- [ ] Track engagement metrics
- [ ] Monitor API usage
- [ ] Log performance statistics
- [ ] Alert on critical errors

## Notes

- Test with real Twitter API
- Monitor rate limits carefully
- Implement proper logging
- Handle all error scenarios
- Ensure production readiness

## Final Deliverables

- ✅ Production-ready GlitchBot
- ✅ All stages completed and tested
- ✅ Proper documentation
- ✅ Deployment configuration
- ✅ Monitoring and alerting

## Deployment

```bash
# Start with PM2
pm2 start ecosystem.config.cjs

# Monitor logs
pm2 logs glitchbot

# Check status
pm2 status
```

## Success Criteria

- [ ] Bot runs 24/7 without crashes
- [ ] Respects all cadence rules
- [ ] Handles errors gracefully
- [ ] Engages with Twitter appropriately
- [ ] Maintains bot personality
- [ ] Tracks all activities properly

**🎉 GlitchBot is now production-ready!**
