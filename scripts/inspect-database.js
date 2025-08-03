#!/usr/bin/env node

const path = require("path");
const fs = require("fs");

// Add the dist directory to the path for imports
const projectRoot = path.join(__dirname, "..");
const distPath = path.join(projectRoot, "dist");

// Import the database class
const GlitchBotDB = require(path.join(distPath, "lib", "db.js")).default;

console.log("🗄️  GlitchBot Database Inspector");
console.log("=====================================\n");

try {
  const db = new GlitchBotDB();

  // Get all tables
  const tables = db.database
    .prepare(
      `
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `
    )
    .all();

  console.log(`📊 Found ${tables.length} tables:\n`);

  tables.forEach((table, index) => {
    const tableName = table.name;
    console.log(`${"=".repeat(60)}`);
    console.log(`📋 Table ${index + 1}: ${tableName.toUpperCase()}`);
    console.log(`${"=".repeat(60)}`);

    // Get table schema
    const schema = db.database.prepare(`PRAGMA table_info(${tableName})`).all();
    console.log("\n🏗️  Schema:");
    schema.forEach((col) => {
      const nullable = col.notnull ? "NOT NULL" : "NULLABLE";
      const defaultVal = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : "";
      const primaryKey = col.pk ? " [PRIMARY KEY]" : "";
      console.log(
        `   ${col.name.padEnd(20)} ${col.type.padEnd(
          15
        )} ${nullable}${defaultVal}${primaryKey}`
      );
    });

    // Get row count
    const count = db.database
      .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
      .get();
    console.log(`\n📊 Row Count: ${count.count}`);

    // Get table contents (limit to 10 rows for readability)
    if (count.count > 0) {
      const rows = db.database
        .prepare(`SELECT * FROM ${tableName} LIMIT 10`)
        .all();
      console.log("\n📋 Contents (showing first 10 rows):");

      if (tableName === "pending_mentions") {
        // Special formatting for pending_mentions
        console.log(
          "┌─────────────────┬─────────────┬──────────────┬─────────────┬─────────────┬─────────────┐"
        );
        console.log(
          "│ Mention ID      │ Author      │ Status       │ Priority    │ Created     │ Processed   │"
        );
        console.log(
          "├─────────────────┼─────────────┼──────────────┼─────────────┼─────────────┼─────────────┤"
        );

        rows.forEach((row) => {
          const mentionId = (row.mention_id || "").substring(0, 15).padEnd(15);
          const author = (`@${row.author_username}` || "")
            .substring(0, 11)
            .padEnd(11);
          const status = (row.status || "").padEnd(12);
          const priority = (row.priority || "").toString().padEnd(11);
          const created = row.created_at
            ? new Date(row.created_at).toLocaleDateString()
            : "N/A";
          const processed = row.processed_at
            ? new Date(row.processed_at).toLocaleDateString()
            : "Not yet";

          console.log(
            `│ ${mentionId} │ ${author} │ ${status} │ ${priority} │ ${created.padEnd(
              11
            )} │ ${processed.padEnd(11)} │`
          );
        });

        console.log(
          "└─────────────────┴─────────────┴──────────────┴─────────────┴─────────────┴─────────────┘"
        );

        // Show status summary
        const statusSummary = db.database
          .prepare(
            `
          SELECT status, COUNT(*) as count 
          FROM pending_mentions 
          GROUP BY status 
          ORDER BY count DESC
        `
          )
          .all();

        if (statusSummary.length > 0) {
          console.log("\n📈 Status Summary:");
          statusSummary.forEach((s) => {
            console.log(`   ${s.status.padEnd(12)}: ${s.count} mentions`);
          });
        }
      } else if (tableName === "mention_state") {
        // Special formatting for mention_state
        console.log(
          "┌─────────────────────┬─────────────────────────────────────┬─────────────────────┐"
        );
        console.log(
          "│ Key                 │ Value                               │ Updated At          │"
        );
        console.log(
          "├─────────────────────┼─────────────────────────────────────┼─────────────────────┤"
        );

        rows.forEach((row) => {
          const key = (row.key || "").padEnd(19);
          const value = (row.value || "").substring(0, 35).padEnd(35);
          const updated = row.updated_at
            ? new Date(row.updated_at).toLocaleString()
            : "N/A";

          console.log(`│ ${key} │ ${value} │ ${updated.padEnd(19)} │`);
        });

        console.log(
          "└─────────────────────┴─────────────────────────────────────┴─────────────────────┘"
        );
      } else if (tableName === "engaged_tweets") {
        // Special formatting for engaged_tweets
        console.log("┌─────────────────┬─────────────┬─────────────────────┐");
        console.log("│ Tweet ID        │ Action      │ Engaged At          │");
        console.log("├─────────────────┼─────────────┼─────────────────────┤");

        rows.forEach((row) => {
          const tweetId = (row.tweet_id || "").substring(0, 15).padEnd(15);
          const action = (row.action || "").padEnd(11);
          const engagedAt = row.engaged_at
            ? new Date(row.engaged_at).toLocaleString()
            : "N/A";

          console.log(`│ ${tweetId} │ ${action} │ ${engagedAt.padEnd(19)} │`);
        });

        console.log("└─────────────────┴─────────────┴─────────────────────┘");
      } else if (tableName === "rate_limits") {
        // Special formatting for rate_limits
        console.log(
          "┌─────────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┐"
        );
        console.log(
          "│ Endpoint        │ Window Type │ Used        │ Window Start│ Twitter Reset       │"
        );
        console.log(
          "├─────────────────┼─────────────┼─────────────┼─────────────┼─────────────────────┤"
        );

        rows.forEach((row) => {
          const endpoint = (row.endpoint || "").substring(0, 15).padEnd(15);
          const windowType = (row.window_type || "")
            .substring(0, 11)
            .padEnd(11);
          const used = (row.requests_used || 0).toString().padEnd(11);
          const windowStart = row.window_start
            ? new Date(row.window_start).toLocaleTimeString()
            : "N/A";
          const twitterReset = row.twitter_reset_time
            ? new Date(row.twitter_reset_time * 1000).toLocaleTimeString()
            : "N/A";

          console.log(
            `│ ${endpoint} │ ${windowType} │ ${used} │ ${windowStart.padEnd(
              11
            )} │ ${twitterReset.padEnd(19)} │`
          );
        });

        console.log(
          "└─────────────────┴─────────────┴─────────────┴─────────────┴─────────────────────┘"
        );
      } else {
        // Generic table display
        rows.forEach((row, i) => {
          console.log(`\n   Row ${i + 1}:`);
          Object.entries(row).forEach(([key, value]) => {
            let displayValue = value;
            if (typeof value === "string" && value.length > 50) {
              displayValue = value.substring(0, 47) + "...";
            }
            console.log(`     ${key.padEnd(20)}: ${displayValue}`);
          });
        });
      }

      if (count.count > 10) {
        console.log(`\n   ... and ${count.count - 10} more rows`);
      }
    } else {
      console.log("\n📭 Table is empty");
    }

    console.log("\n");
  });

  // Show database file info
  const dbPath = path.join(projectRoot, "glitchbot.db");
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log(`${"=".repeat(60)}`);
    console.log("💾 Database File Info");
    console.log(`${"=".repeat(60)}`);
    console.log(`📁 Path: ${dbPath}`);
    console.log(`📏 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`🕒 Modified: ${stats.mtime.toLocaleString()}`);
  }

  // Show queue statistics
  const queueStats = db.database
    .prepare(
      `
    SELECT 
      COUNT(*) as total_mentions,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      MIN(created_at) as oldest_mention,
      MAX(created_at) as newest_mention,
      AVG(priority) as avg_priority
    FROM pending_mentions
  `
    )
    .get();

  if (queueStats.total_mentions > 0) {
    console.log(`\n${"=".repeat(60)}`);
    console.log("📊 Queue Statistics");
    console.log(`${"=".repeat(60)}`);
    console.log(`📨 Total Mentions: ${queueStats.total_mentions}`);
    console.log(`⏳ Pending: ${queueStats.pending}`);
    console.log(`🔄 Processing: ${queueStats.processing}`);
    console.log(`✅ Completed: ${queueStats.completed}`);
    console.log(`❌ Failed: ${queueStats.failed}`);
    console.log(
      `📅 Oldest: ${
        queueStats.oldest_mention
          ? new Date(queueStats.oldest_mention).toLocaleString()
          : "N/A"
      }`
    );
    console.log(
      `📅 Newest: ${
        queueStats.newest_mention
          ? new Date(queueStats.newest_mention).toLocaleString()
          : "N/A"
      }`
    );
    console.log(
      `🎯 Average Priority: ${
        queueStats.avg_priority ? queueStats.avg_priority.toFixed(1) : "N/A"
      }`
    );

    // Calculate processing rate
    if (queueStats.completed > 0) {
      const completionRate = (
        (queueStats.completed / queueStats.total_mentions) *
        100
      ).toFixed(1);
      console.log(`⚡ Completion Rate: ${completionRate}%`);
    }
  }

  console.log(`\n✅ Database inspection complete!\n`);
} catch (error) {
  console.error("❌ Error inspecting database:", error.message);
  console.error(
    "\n💡 Make sure the project is built (npm run build) and database exists"
  );
  process.exit(1);
}
