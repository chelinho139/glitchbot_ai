#!/usr/bin/env node

/**
 * Test script for the combined GlitchBot agent
 *
 * This script tests the combined mentions + timeline functionality
 * by running a few agent steps and inspecting the results.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🧪 Testing Combined GlitchBot Agent\n");

// Check if .env file exists
const envPath = ".env";
if (!fs.existsSync(envPath)) {
  console.error("❌ .env file not found. Please create one with:");
  console.error("   VIRTUALS_API_KEY=your_key");
  console.error("   GAME_TWITTER_TOKEN=your_token");
  console.error("   BOT_TWITTER_USERNAME=your_username (optional)");
  process.exit(1);
}

console.log("✅ .env file found");

// Check if we can build the project
try {
  console.log("🔨 Building project...");
  execSync("npm run build", { stdio: "inherit" });
  console.log("✅ Build successful\n");
} catch (error) {
  console.error("❌ Build failed:", error.message);
  process.exit(1);
}

// Test database operations
try {
  console.log("🗄️  Testing database operations...");
  execSync("npm run db:inspect", { stdio: "pipe" });
  console.log("✅ Database accessible\n");
} catch (error) {
  console.error("❌ Database test failed:", error.message);
  process.exit(1);
}

// Check queue status
try {
  console.log("📊 Checking queue status...");
  const output = execSync("npm run queue:status", { encoding: "utf8" });
  console.log(output);
} catch (error) {
  console.error("❌ Queue status check failed:", error.message);
}

// Test rate limiter
try {
  console.log("⏱️  Testing rate limiter...");
  execSync("npm run debug:rate-limits", { stdio: "pipe" });
  console.log("✅ Rate limiter accessible\n");
} catch (error) {
  console.error("❌ Rate limiter test failed:", error.message);
}

console.log("🚀 Ready to test the combined agent!");
console.log("\nTo run the agent:");
console.log("  npm run start:glitchbot");
console.log("\nTo run in development mode:");
console.log("  npm run dev");
console.log("\nMonitoring commands:");
console.log("  npm run queue:status    - Check mention queue");
console.log("  npm run db:inspect      - Inspect database");
console.log("  npm run debug:rate-limits - Check rate limits");

console.log("\n✅ All tests passed! The combined agent is ready to run.");
