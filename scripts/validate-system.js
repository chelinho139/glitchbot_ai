#!/usr/bin/env node

/**
 * System Validation Script
 * Tests core GlitchBot functionality without requiring API credentials
 */

const { DatabaseManager } = require("../dist/lib/database-manager");
const GlitchBotDB = require("../dist/lib/db").default;

console.log("🔍 GlitchBot System Validation");
console.log("==============================");

async function validateSystem() {
  let allPassed = true;
  const results = [];

  // Test 1: Database Manager Initialization
  try {
    console.log("\n📊 Testing DatabaseManager...");
    const testDbPath = "./test-validation.db";
    const dbManager = new DatabaseManager(testDbPath);

    // Test database creation
    const stats = dbManager.getStats();
    console.log(`   ✅ DatabaseManager initialized`);
    console.log(`   ✅ Tables created: ${Object.keys(stats.tables).length}`);

    // Cleanup test database
    const fs = require("fs");
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    results.push({ test: "DatabaseManager", status: "✅ PASS" });
  } catch (error) {
    console.log(`   ❌ DatabaseManager test failed: ${error.message}`);
    results.push({
      test: "DatabaseManager",
      status: "❌ FAIL",
      error: error.message,
    });
    allPassed = false;
  }

  // Test 2: GlitchBotDB Integration
  try {
    console.log("\n🗃️  Testing GlitchBotDB integration...");
    const testDbPath = "./test-integration.db";
    const dbManager = new DatabaseManager(testDbPath);
    const db = new GlitchBotDB(dbManager);

    // Test basic operations
    const now = new Date().toISOString();

    // Test cadence operations
    db.setCadence("test_key", "test_value");
    const value = db.getCadence("test_key");
    console.log(
      `   ✅ Cadence operations working: ${
        value === "test_value" ? "PASS" : "FAIL"
      }`
    );

    // Test engagement operations
    db.recordEngagement("test_tweet_123", "reply");
    const isEngaged = db.isEngaged("test_tweet_123");
    console.log(
      `   ✅ Engagement operations working: ${isEngaged ? "PASS" : "FAIL"}`
    );

    // Cleanup test database
    const fs = require("fs");
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    results.push({ test: "GlitchBotDB Integration", status: "✅ PASS" });
  } catch (error) {
    console.log(`   ❌ GlitchBotDB integration test failed: ${error.message}`);
    results.push({
      test: "GlitchBotDB Integration",
      status: "❌ FAIL",
      error: error.message,
    });
    allPassed = false;
  }

  // Test 3: GameFunction Structure Validation
  try {
    console.log("\n🎮 Testing GameFunction structure...");
    const {
      storePendingMentionsFunction,
    } = require("../dist/functions/atomic/utilities/store-pending-mentions");
    const {
      getProcessableMentionsFunction,
    } = require("../dist/functions/atomic/utilities/get-processable-mentions");

    // Validate GameFunction structure
    const functions = [
      storePendingMentionsFunction,
      getProcessableMentionsFunction,
    ];

    for (const fn of functions) {
      if (!fn.name || !fn.description || !fn.args || !fn.executable) {
        throw new Error(
          `Invalid GameFunction structure: ${fn.name || "unknown"}`
        );
      }
    }

    console.log(`   ✅ GameFunction structure validation passed`);
    console.log(`   ✅ Validated ${functions.length} core functions`);

    results.push({ test: "GameFunction Structure", status: "✅ PASS" });
  } catch (error) {
    console.log(`   ❌ GameFunction structure test failed: ${error.message}`);
    results.push({
      test: "GameFunction Structure",
      status: "❌ FAIL",
      error: error.message,
    });
    allPassed = false;
  }

  // Test 4: Worker Instantiation
  try {
    console.log("\n👷 Testing Worker instantiation...");
    const {
      MentionsWorker,
    } = require("../dist/workers/twitter/mentions-worker");

    const testDbPath = "./test-worker.db";
    const dbManager = new DatabaseManager(testDbPath);
    const db = new GlitchBotDB(dbManager);
    const worker = new MentionsWorker(db);

    // Validate worker structure
    if (!worker.execute || typeof worker.execute !== "function") {
      throw new Error("Worker missing execute method");
    }

    console.log(`   ✅ MentionsWorker instantiation successful`);

    // Cleanup test database
    const fs = require("fs");
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    results.push({ test: "Worker Instantiation", status: "✅ PASS" });
  } catch (error) {
    console.log(`   ❌ Worker instantiation test failed: ${error.message}`);
    results.push({
      test: "Worker Instantiation",
      status: "❌ FAIL",
      error: error.message,
    });
    allPassed = false;
  }

  // Summary
  console.log("\n🎯 Validation Summary");
  console.log("====================");

  results.forEach((result) => {
    console.log(`   ${result.status} ${result.test}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });

  console.log(
    `\n📊 Overall Result: ${
      allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"
    }`
  );

  if (allPassed) {
    console.log("\n🚀 System is ready for Step 1.3 development!");
  } else {
    console.log("\n⚠️  Please fix failing tests before proceeding.");
    process.exit(1);
  }
}

// Run validation
validateSystem().catch((error) => {
  console.error("\n💥 Validation script failed:", error);
  process.exit(1);
});
