#!/usr/bin/env ts-node

require("dotenv").config();

const { TwitterApi } = require("@virtuals-protocol/game-twitter-node");

async function debugRateLimits() {
  console.log("🔍 Debugging Twitter API Rate Limits...");
  console.log("=".repeat(50));

  const gameToken = process.env.GAME_TWITTER_TOKEN;
  if (!gameToken) {
    console.log("❌ GAME_TWITTER_TOKEN not found");
    return;
  }

  console.log(`🔑 Using GAME_TWITTER_TOKEN: ${gameToken.substring(0, 10)}...`);

  const client = new TwitterApi({
    gameTwitterAccessToken: gameToken,
  });

  try {
    console.log("🧪 Test 1: Making API call to /2/users/me...");
    const userResponse = await client.v2.me();

    console.log("\n📋 User Response Analysis:");
    console.log("✅ API call successful");
    console.log(`📊 User Data:`, {
      id: userResponse.data.id,
      username: userResponse.data.username,
      name: userResponse.data.name,
    });

    console.log("\n🔍 Full Response Object Structure:");
    console.log("Response keys:", Object.keys(userResponse));
    console.log("Response type:", typeof userResponse);
    console.log("Full response:", JSON.stringify(userResponse, null, 2));

    // Test mentions endpoint
    console.log("\n🧪 Test 2: Testing mentions timeline endpoint...");
    const mentionsResponse = await client.v2.userMentionTimeline(
      userResponse.data.id,
      { max_results: 5 }
    );

    console.log("\n📊 Mentions Response Analysis:");
    console.log(
      `✅ Mentions call successful, got ${
        mentionsResponse.data?.data?.length || 0
      } mentions`
    );

    console.log("\n🔍 Full Mentions Response Structure:");
    console.log("Mentions response keys:", Object.keys(mentionsResponse));
    console.log("Mentions data structure:", {
      hasData: !!mentionsResponse.data,
      dataKeys: mentionsResponse.data ? Object.keys(mentionsResponse.data) : [],
      metaKeys: mentionsResponse.data?.meta
        ? Object.keys(mentionsResponse.data.meta)
        : [],
    });

    // IMPORTANT: Check the _rateLimit property specifically
    console.log("\n🔍 INSPECTING _rateLimit PROPERTY:");
    console.log("mentionsResponse._rateLimit:", mentionsResponse._rateLimit);
    if (mentionsResponse._rateLimit) {
      console.log("_rateLimit type:", typeof mentionsResponse._rateLimit);
      console.log("_rateLimit keys:", Object.keys(mentionsResponse._rateLimit));
      console.log(
        "_rateLimit full object:",
        JSON.stringify(mentionsResponse._rateLimit, null, 2)
      );
    }

    // Check other private properties
    console.log("\n🔍 OTHER PRIVATE PROPERTIES:");
    console.log(
      "_realData:",
      mentionsResponse._realData ? "exists" : "undefined"
    );
    console.log("_queryParams:", mentionsResponse._queryParams);
    console.log("_sharedParams:", mentionsResponse._sharedParams);

    // Test a simpler endpoint to compare
    console.log("\n🧪 Test 3: Testing simpler user lookup...");
    try {
      const userLookupResponse = await client.v2.user(userResponse.data.id);
      console.log("\n📊 User Lookup Response:");
      console.log("User lookup keys:", Object.keys(userLookupResponse));
      console.log(
        "User lookup structure:",
        JSON.stringify(userLookupResponse, null, 2)
      );
    } catch (lookupError) {
      console.log("❌ User lookup failed:", lookupError.message);
    }

    // Let's make multiple API calls quickly to see if we hit limits
    console.log(
      "\n🧪 Test 4: Making multiple rapid calls to test rate limiting..."
    );
    for (let i = 0; i < 3; i++) {
      try {
        console.log(`  Call ${i + 1}...`);
        const rapidResponse = await client.v2.me();
        console.log(`  ✅ Call ${i + 1} successful`);

        // Check if we can extract any rate limit info
        if (rapidResponse._rateLimit || rapidResponse.rateLimit) {
          console.log(
            `  📊 Rate limit info found:`,
            rapidResponse.rateLimit || rapidResponse._rateLimit
          );
        }
      } catch (rapidError) {
        console.log(`  ❌ Call ${i + 1} failed:`, rapidError.message);
        if (rapidError.code === 429) {
          console.log(`  🚫 Hit rate limit on call ${i + 1}!`);
          console.log(`  Rate limit details:`, rapidError);
          break;
        }
      }

      // Small delay between calls
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Final summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 RATE LIMIT DISCOVERY SUMMARY:");
    console.log("=".repeat(60));
    console.log("✅ Authentication: Working with GAME_TWITTER_TOKEN");
    console.log("✅ User endpoint: Working");
    console.log("✅ Mentions endpoint: Working");
    console.log(
      "❌ Rate limit headers: Not exposed by @virtuals-protocol/game-twitter-node"
    );
    console.log(
      "💡 Recommendation: Use conservative limits or test by hitting actual limits"
    );
  } catch (error) {
    console.log("❌ API call failed:", error.message);
    console.log("Error details:", {
      code: error.code,
      message: error.message,
      rateLimit: error.rateLimit,
    });

    if (error.code === 429) {
      console.log("🚫 We hit a rate limit! This tells us we're at the limit:");
      console.log(`   Code: ${error.code}`);
      console.log(`   Rate Limit:`, error.rateLimit);
      console.log("✅ This is valuable - we found our actual limit!");
    }
  }
}

debugRateLimits().catch(console.error);
