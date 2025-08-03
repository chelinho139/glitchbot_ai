#!/usr/bin/env ts-node

require("dotenv").config();

const {
  createRateLimitedTwitterClient,
} = require("../src/lib/rate-limited-twitter-client");
const { globalRateLimiter } = require("../src/persistence/global/rate-limiter");

async function testRateLimiter() {
  console.log("🧪 Rate Limiter Comprehensive Test Suite");
  console.log("=".repeat(50));

  // Test 1: Cache functionality
  console.log("\n📦 Test 1: User ID Caching");
  const client = createRateLimitedTwitterClient({
    gameTwitterAccessToken: process.env.GAME_TWITTER_TOKEN,
    workerId: "test-worker",
    defaultPriority: "medium",
  });

  console.log("Cache status before:", client.getCacheStatus());

  // Test 2: Rate limit checking without API calls
  console.log("\n🚦 Test 2: Rate Limit Checking Logic");
  const endpoints = ["get_user", "fetch_mentions", "reply_tweet", "like_tweet"];

  for (const endpoint of endpoints) {
    const check = await globalRateLimiter.canMakeRequest(
      endpoint,
      "test-worker",
      "medium"
    );
    console.log(`${endpoint}: ${check.allowed ? "✅ ALLOWED" : "❌ BLOCKED"}`);
    if (!check.allowed) {
      console.log(`  Reason: ${check.reason}`);
      console.log(`  Retry in: ${check.retry_after_seconds}s`);
    }
  }

  // Test 3: Remaining capacity
  console.log("\n📊 Test 3: Remaining Capacity");
  for (const endpoint of endpoints) {
    try {
      const capacity = await globalRateLimiter.getRemainingCapacity(endpoint);
      console.log(`${endpoint}:`);
      console.log(
        `  15min: ${capacity.per_15min.remaining} remaining, resets ${capacity.per_15min.resets_at}`
      );
      console.log(
        `  Hour:  ${capacity.per_hour.remaining} remaining, resets ${capacity.per_hour.resets_at}`
      );
      console.log(
        `  Day:   ${capacity.per_day.remaining} remaining, resets ${capacity.per_day.resets_at}`
      );
    } catch (error) {
      console.log(`${endpoint}: Error - ${error.message}`);
    }
  }

  // Test 4: Database inspection
  console.log("\n🗄️ Test 4: Database State");
  try {
    const db = globalRateLimiter.db_instance;
    const stmt = db.prepare(`
      SELECT endpoint, window_type, requests_used, 
             datetime(window_start/1000, 'unixepoch') as window_time,
             CASE 
               WHEN twitter_reset_time IS NOT NULL 
               THEN datetime(twitter_reset_time, 'unixepoch')
               ELSE NULL 
             END as twitter_reset
      FROM rate_limits 
      WHERE requests_used > 0 
      ORDER BY endpoint, window_type
    `);

    const results = stmt.all();
    console.log("Current rate limit state:");
    results.forEach((row) => {
      console.log(
        `  ${row.endpoint} (${row.window_type}): ${
          row.requests_used
        } used, window: ${row.window_time}, twitter_reset: ${
          row.twitter_reset || "none"
        }`
      );
    });
  } catch (error) {
    console.log("Database inspection error:", error.message);
  }

  // Test 5: Reset time calculation
  console.log("\n⏰ Test 5: Reset Time Logic");
  console.log("Current time:", new Date().toISOString());

  // Test Twitter reset time vs mathematical calculation
  const now = new Date();
  const testResetTime = Math.floor(now.getTime() / 1000) + 3600; // 1 hour from now
  console.log(
    "Test Twitter reset time:",
    new Date(testResetTime * 1000).toISOString()
  );

  // Test 6: Clear cache and test
  console.log("\n🧹 Test 6: Cache Management");
  console.log("Clearing user cache...");
  client.clearUserCache();
  console.log("Cache status after clear:", client.getCacheStatus());

  console.log("\n✅ Rate Limiter Test Suite Complete!");
}

testRateLimiter().catch(console.error);
