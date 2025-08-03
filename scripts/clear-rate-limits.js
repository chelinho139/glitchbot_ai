#!/usr/bin/env node

/**
 * Clear Rate Limits Script
 * Clears only the rate_limits table to reset rate limiting state
 */

const { DatabaseManager } = require("../dist/lib/database-manager");

console.log("🗑️  GlitchBot Rate Limits Cleaner");
console.log("=================================");

try {
  // Initialize database
  const dbManager = new DatabaseManager("./glitchbot.db");

  // Clear rate limits table
  const result = dbManager.database.prepare("DELETE FROM rate_limits").run();

  console.log(`✅ Cleared ${result.changes} rate limit records`);
  console.log("🚀 Rate limiting state has been reset!");
  console.log("");
  console.log(
    "💡 Next API calls will start fresh with full rate limit capacity"
  );
} catch (error) {
  console.error("❌ Failed to clear rate limits:", error.message);
  process.exit(1);
}
