#!/usr/bin/env node

/**
 * GlitchBot Database Reset Script
 *
 * DANGER: This script completely wipes all data and resets the database.
 * Use only for development and testing purposes.
 */

const fs = require("fs");
const path = require("path");

console.log("🔥 GlitchBot Database Reset");
console.log("===========================");
console.log("⚠️  WARNING: This will DELETE ALL DATA!");
console.log("");

// Check if we're in production
if (process.env.NODE_ENV === "production") {
  console.error("❌ ERROR: Cannot reset database in production environment!");
  console.error('   Set NODE_ENV to "development" or "test" to proceed.');
  process.exit(1);
}

// Confirm deletion in interactive mode
if (process.argv.includes("--confirm") || process.argv.includes("-y")) {
  // Skip confirmation if --confirm or -y flag is provided
  performReset();
} else {
  // Ask for confirmation
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(
    "Are you sure you want to DELETE ALL DATABASE DATA? (yes/no): ",
    (answer) => {
      rl.close();

      if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
        performReset();
      } else {
        console.log("✅ Reset cancelled - no data was deleted.");
        process.exit(0);
      }
    }
  );
}

function performReset() {
  console.log("🗑️  Starting database reset...");
  console.log("");

  const dbPath = path.join(__dirname, "..", "glitchbot.db");
  const backupDir = path.join(__dirname, "..", "backups");

  try {
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log("📁 Created backups directory");
    }

    // Create backup if database exists
    if (fs.existsSync(dbPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(
        backupDir,
        `glitchbot_backup_${timestamp}.db`
      );

      console.log("💾 Creating backup before reset...");
      fs.copyFileSync(dbPath, backupPath);
      console.log(
        `   Backup saved: ${path.relative(process.cwd(), backupPath)}`
      );

      // Delete the current database
      fs.unlinkSync(dbPath);
      console.log("🗑️  Deleted existing database");
    } else {
      console.log("ℹ️  No existing database found");
    }

    // Clear any built files and rebuild
    console.log("🔨 Rebuilding project...");
    const { execSync } = require("child_process");

    try {
      // Remove dist directory
      const distPath = path.join(__dirname, "..", "dist");
      if (fs.existsSync(distPath)) {
        fs.rmSync(distPath, { recursive: true, force: true });
        console.log("🗑️  Cleared dist directory");
      }

      // Rebuild project
      execSync("npm run build", {
        cwd: path.join(__dirname, ".."),
        stdio: "pipe",
      });
      console.log("✅ Project rebuilt successfully");
    } catch (buildError) {
      console.warn("⚠️  Build failed, but continuing with database reset");
      console.warn(`   Error: ${buildError.message}`);
    }

    // Initialize fresh database
    console.log("🏗️  Initializing fresh database...");

    try {
      // Import and initialize the database
      const GlitchBotDB = require(path.join(
        __dirname,
        "..",
        "dist",
        "lib",
        "db.js"
      )).default;
      const db = new GlitchBotDB();

      console.log("✅ Fresh database initialized with clean schema");

      // Verify tables were created
      const tables = db.database
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' 
        ORDER BY name
      `
        )
        .all();

      console.log("📋 Created tables:");
      tables.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table.name.toUpperCase()}`);
      });
    } catch (dbError) {
      console.error("❌ Failed to initialize fresh database");
      console.error(`   Error: ${dbError.message}`);
      console.error("   Try running: npm run build && npm run db:reset");
      process.exit(1);
    }

    console.log("");
    console.log("🎉 Database reset completed successfully!");
    console.log("");
    console.log("📊 What was reset:");
    console.log("   • All mention queue data cleared");
    console.log("   • All rate limit history cleared");
    console.log("   • All engagement tracking cleared");
    console.log("   • Fresh schema with empty tables");
    console.log("");
    console.log("🚀 Ready for fresh development!");
    console.log("");
    console.log("💡 Next steps:");
    console.log("   • Run: npm run queue:status (should show empty queue)");
    console.log("   • Run: npm run db:inspect (should show clean schema)");
    console.log("   • Test: npm test (to verify everything works)");
  } catch (error) {
    console.error("❌ Reset failed:");
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on("SIGINT", () => {
  console.log("\n❌ Reset cancelled by user");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n❌ Reset cancelled by system");
  process.exit(0);
});
