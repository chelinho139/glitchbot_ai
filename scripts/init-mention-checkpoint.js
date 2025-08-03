#!/usr/bin/env node

/**
 * Initialize Mention Checkpoint Script
 * Sets the last_since_id to start fetching mentions from a specific point
 * Useful for fresh setups to avoid processing old mentions
 */

const { DatabaseManager } = require("../dist/lib/database-manager");
const GlitchBotDB = require("../dist/lib/db").default;

function showUsage() {
  console.log("🔄 GlitchBot Mention Checkpoint Initializer");
  console.log("==========================================");
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/init-mention-checkpoint.js <tweet_id>");
  console.log("");
  console.log("Examples:");
  console.log("  node scripts/init-mention-checkpoint.js 1952105100731969704");
  console.log("  npm run init:checkpoint 1952105100731969704");
  console.log("");
  console.log("What this does:");
  console.log("  • Sets the last_since_id in mention_state table");
  console.log("  • Future fetch_mentions will only get newer mentions");
  console.log("  • Prevents processing old mentions you've already replied to");
  console.log("");
  console.log("How to find your tweet ID:");
  console.log(
    "  • Go to your latest reply: https://x.com/glitchbot_ai/status/TWEET_ID"
  );
  console.log("  • Copy the number after /status/");
  console.log("  • Use that number as the tweet_id parameter");
}

function validateTweetId(tweetId) {
  // Twitter tweet IDs are typically 19 digits (snowflake format)
  // They should be numeric and within reasonable bounds
  if (!tweetId) {
    return { valid: false, error: "Tweet ID is required" };
  }

  if (!/^\d+$/.test(tweetId)) {
    return { valid: false, error: "Tweet ID must be numeric" };
  }

  if (tweetId.length < 15 || tweetId.length > 20) {
    return {
      valid: false,
      error: "Tweet ID length seems invalid (should be 15-20 digits)",
    };
  }

  // Basic sanity check - should be a reasonably recent snowflake ID
  const tweetIdNum = BigInt(tweetId);
  const minValidId = BigInt("1400000000000000000"); // Roughly 2021+
  const maxValidId = BigInt("2000000000000000000"); // Future bound

  if (tweetIdNum < minValidId) {
    return { valid: false, error: "Tweet ID seems too old (pre-2021)" };
  }

  if (tweetIdNum > maxValidId) {
    return { valid: false, error: "Tweet ID seems invalid (too large)" };
  }

  return { valid: true };
}

async function initializeCheckpoint(tweetId) {
  console.log("🔄 GlitchBot Mention Checkpoint Initializer");
  console.log("==========================================");
  console.log("");

  // Validate tweet ID
  const validation = validateTweetId(tweetId);
  if (!validation.valid) {
    console.log(`❌ Invalid tweet ID: ${validation.error}`);
    console.log("");
    showUsage();
    process.exit(1);
  }

  try {
    // Initialize database
    console.log("📊 Initializing database...");
    const dbManager = new DatabaseManager("./glitchbot.db");
    const db = new GlitchBotDB(dbManager);

    // Check current state
    console.log("🔍 Checking current mention state...");
    const currentSinceId =
      db.getCadence("last_since_id") ||
      db.database
        .prepare("SELECT value FROM mention_state WHERE key = ?")
        .get("last_since_id")?.value;

    if (currentSinceId) {
      console.log(`   📍 Current since_id: ${currentSinceId}`);
    } else {
      console.log("   📍 Current since_id: Not set");
    }

    // Show what we're about to do
    console.log("");
    console.log("🎯 Setting new checkpoint...");
    console.log(`   📍 New since_id: ${tweetId}`);
    console.log(
      `   🔗 Tweet URL: https://x.com/glitchbot_ai/status/${tweetId}`
    );
    console.log("   ℹ️  Future mentions will only be fetched AFTER this tweet");

    // Update the checkpoint
    const now = new Date().toISOString();

    // Update both possible locations for compatibility
    db.database
      .prepare(
        `
      INSERT OR REPLACE INTO mention_state 
      (key, value, updated_at)
      VALUES ('last_since_id', ?, ?)
    `
      )
      .run(tweetId, now);

    db.database
      .prepare(
        `
      INSERT OR REPLACE INTO mention_state 
      (key, value, updated_at)
      VALUES ('last_fetch_time', ?, ?)
    `
      )
      .run(now, now);

    console.log("");
    console.log("✅ Checkpoint initialized successfully!");
    console.log("");
    console.log("📋 Summary:");
    console.log(`   📍 Since ID: ${tweetId}`);
    console.log(`   📅 Updated: ${now}`);
    console.log("   🎯 Status: Ready for fresh mention fetching");
    console.log("");
    console.log("🚀 Next steps:");
    console.log("   1. Run: npm run worker:mentions");
    console.log("   2. Check: npm run queue:status");
    console.log("   3. Monitor: npm run db:inspect");
    console.log("");
    console.log(
      "💡 The bot will now only process mentions newer than your specified tweet!"
    );
  } catch (error) {
    console.error("❌ Failed to initialize checkpoint:", error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  showUsage();
  process.exit(0);
}

const tweetId = args[0];

// Run the initialization
initializeCheckpoint(tweetId).catch((error) => {
  console.error("💥 Script failed:", error);
  process.exit(1);
});
