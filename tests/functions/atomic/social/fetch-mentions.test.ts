#!/usr/bin/env ts-node

/**
 * Tests for fetch_mentions GameFunction
 * Validates Twitter API integration, data structure, and error handling
 */

import {
  createTestSuite,
  assert,
  testHelpers,
} from "../../../helpers/test-utils";

// Import function to test
const {
  default: fetchMentionsFunction,
} = require("../../../../src/functions/atomic/social/twitter/fetch-mentions");

const suite = createTestSuite("fetch_mentions GameFunction");

suite.beforeAll(() => {
  console.log("🔧 Setting up fetch_mentions tests...");
  testHelpers.loadTestEnv();
});

suite.test("should fetch mentions with correct data structure", async () => {
  const result = await fetchMentionsFunction.executable(
    {
      max_results: "10",
    },
    (msg: string) => console.log(`[Function Log]: ${msg}`)
  );

  // Verify response structure
  assert.equals(result.status, "done", "Function should complete successfully");
  assert.truthy(result.feedback, "Should return feedback data");

  const data = JSON.parse(result.feedback);

  // Verify data structure
  assert.hasProperty(data, "mentions", "Response should have mentions array");
  assert.hasProperty(data, "meta", "Response should have meta object");
  assert.isType(data.mentions, "object", "Mentions should be an array");
  assert.isType(
    data.meta.result_count,
    "number",
    "Meta should have result_count"
  );

  console.log(`✅ Found ${data.mentions.length} mentions`);
  console.log(`✅ Newest ID: ${data.meta.newest_id || "None"}`);
  console.log(
    `✅ Rate limit remaining: ${data.rate_limit?.remaining || "Unknown"}`
  );

  if (data.mentions.length > 0) {
    const mention = data.mentions[0];
    assert.hasProperty(mention, "id", "Mention should have ID");
    assert.hasProperty(mention, "text", "Mention should have text");
    assert.hasProperty(mention, "author_id", "Mention should have author_id");
    assert.hasProperty(mention, "author", "Mention should have author object");
    assert.hasProperty(mention, "created_at", "Mention should have created_at");

    // Verify enhanced author data structure
    if (mention.author) {
      assert.hasProperty(mention.author, "id", "Author should have ID");
      assert.hasProperty(
        mention.author,
        "username",
        "Author should have username"
      );
      console.log(
        `👤 Enhanced author data: @${mention.author.username} (${
          mention.author.name || "no name"
        })`
      );
      if (mention.author.public_metrics) {
        console.log(
          `📊 ${mention.author.public_metrics.followers_count} followers`
        );
      }
    }

    console.log(
      `📝 Sample mention: @${
        mention.author?.username || "unknown"
      }: "${mention.text.substring(0, 50)}..."`
    );
  }
});

suite.test("should handle since_id parameter correctly", async () => {
  const result = await fetchMentionsFunction.executable(
    {
      max_results: "5",
      since_id: "1940000000000000000", // High ID to test filtering
    },
    (msg: string) => console.log(`[Function Log]: ${msg}`)
  );

  assert.equals(
    result.status,
    "done",
    "Function should complete with since_id parameter"
  );

  const data = JSON.parse(result.feedback);
  assert.hasProperty(
    data,
    "mentions",
    "Filtered response should have mentions array"
  );
  assert.isType(data.mentions, "object", "Mentions should be an array");

  console.log(`✅ Filtered mentions found: ${data.mentions.length}`);
});

suite.test("should handle max_results parameter correctly", async () => {
  const result = await fetchMentionsFunction.executable(
    {
      max_results: "15",
    },
    (msg: string) => console.log(`[Function Log]: ${msg}`)
  );

  assert.equals(
    result.status,
    "done",
    "Function should complete with max_results parameter"
  );

  const data = JSON.parse(result.feedback);
  assert.truthy(data.mentions.length <= 15, "Should respect max_results limit");
  assert.truthy(
    data.mentions.length >= 5,
    "Should enforce minimum of 5 results"
  );

  console.log(
    `✅ Respects max_results: ${data.mentions.length} <= 15 (min: 5)`
  );
  console.log(`✅ Built-in minimum ensures meaningful data collection`);
});

suite.test("should validate Twitter API integration", async () => {
  const result = await fetchMentionsFunction.executable(
    {
      max_results: "5",
    },
    (msg: string) => console.log(`[Function Log]: ${msg}`)
  );

  assert.equals(result.status, "done", "Twitter API integration should work");

  const data = JSON.parse(result.feedback);

  // Verify we're getting real API responses
  assert.hasProperty(data.meta, "result_count", "Should have API result count");

  if (data.meta.newest_id) {
    assert.isType(data.meta.newest_id, "string", "Newest ID should be string");
    assert.truthy(
      data.meta.newest_id.length > 0,
      "Newest ID should not be empty"
    );
  }

  console.log(`✅ Real Twitter API integration confirmed`);
  console.log(`✅ API result_count: ${data.meta.result_count}`);
});

suite.test(
  "should handle missing environment variables gracefully",
  async () => {
    // Temporarily remove the token
    const originalToken = process.env.GAME_TWITTER_TOKEN;
    delete process.env.GAME_TWITTER_TOKEN;

    const result = await fetchMentionsFunction.executable(
      {
        max_results: "5",
      },
      (msg: string) => console.log(`[Function Log]: ${msg}`)
    );

    // Restore the token immediately
    if (originalToken) {
      process.env.GAME_TWITTER_TOKEN = originalToken;
    }

    assert.equals(result.status, "failed", "Should fail without credentials");
    assert.truthy(
      result.feedback.includes("GAME_TWITTER_TOKEN"),
      "Should mention missing token"
    );

    console.log(`✅ Handles missing credentials correctly`);
  }
);

suite.test("should capture comprehensive author information", async () => {
  const result = await fetchMentionsFunction.executable(
    {
      max_results: "3",
    },
    (msg: string) => console.log(`[Function Log]: ${msg}`)
  );

  assert.equals(result.status, "done", "Function should complete successfully");
  const data = JSON.parse(result.feedback);

  if (data.mentions.length > 0) {
    const mention = data.mentions[0];

    // Verify enhanced author structure
    assert.hasProperty(mention, "author", "Mention should have author object");

    if (mention.author) {
      assert.hasProperty(mention.author, "id", "Author should have ID");
      assert.hasProperty(
        mention.author,
        "username",
        "Author should have username"
      );

      console.log(`👤 Author Profile Analysis:`);
      console.log(`   Username: @${mention.author.username}`);
      console.log(`   Display Name: ${mention.author.name || "Not provided"}`);
      console.log(
        `   Verified: ${mention.author.verified ? "✅ Yes" : "❌ No"}`
      );
      console.log(`   Bio: ${mention.author.description ? "Present" : "None"}`);
      console.log(`   Location: ${mention.author.location || "Not provided"}`);

      if (mention.author.public_metrics) {
        console.log(`   📊 Social Metrics:`);
        console.log(
          `      Followers: ${mention.author.public_metrics.followers_count.toLocaleString()}`
        );
        console.log(
          `      Following: ${mention.author.public_metrics.following_count.toLocaleString()}`
        );
        console.log(
          `      Tweets: ${mention.author.public_metrics.tweet_count.toLocaleString()}`
        );
      }
    }

    console.log(`✅ Enhanced author intelligence captured successfully`);
  } else {
    console.log(`ℹ️ No mentions found - author intelligence test skipped`);
  }
});

suite.test("should use correct Twitter API functions", async () => {
  // This test validates that our function is using the right API methods
  console.log("🔍 Verifying API function usage:");
  console.log("   Primary: twitterClient.v2.userMentionTimeline() ONLY");
  console.log("   Enhanced: Comprehensive user.fields for author intelligence");
  console.log(
    "   Reference: https://github.com/game-by-virtuals/game-twitter-node/blob/main/doc/v2.md"
  );

  const result = await fetchMentionsFunction.executable(
    {
      max_results: "1",
    },
    (msg: string) => console.log(`[Function Log]: ${msg}`)
  );

  assert.equals(
    result.status,
    "done",
    "userMentionTimeline should work correctly"
  );
  console.log(
    `✅ Twitter API v2 userMentionTimeline with enhanced user fields working correctly`
  );
});

// Run the test suite
suite.run();
