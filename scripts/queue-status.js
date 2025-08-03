#!/usr/bin/env node

const path = require("path");

// Import the database class
const projectRoot = path.join(__dirname, "..");
const distPath = path.join(projectRoot, "dist");
const GlitchBotDB = require(path.join(distPath, "lib", "db.js")).default;

console.log("🎯 GlitchBot Queue Status");
console.log("========================\n");

try {
  const db = new GlitchBotDB();

  // Get queue statistics
  const queueStats = db.database
    .prepare(
      `
    SELECT 
      COUNT(*) as total_mentions,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      MAX(created_at) as newest_mention,
      AVG(priority) as avg_priority
    FROM pending_mentions
  `
    )
    .get();

  // Get current checkpoint
  const checkpoint = db.database
    .prepare(
      `
    SELECT value FROM mention_state WHERE key = 'last_since_id'
  `
    )
    .get();

  // Get rate limit status for key endpoints
  const rateLimits = db.database
    .prepare(
      `
    SELECT endpoint, window_type, requests_used, window_start
    FROM rate_limits 
    WHERE window_type = 'per_hour' 
    ORDER BY endpoint
  `
    )
    .all();

  // Display queue status
  console.log("📊 QUEUE STATUS");
  console.log("═══════════════");
  if (queueStats.total_mentions > 0) {
    console.log(`📨 Total Mentions: ${queueStats.total_mentions}`);
    console.log(`⏳ Pending: ${queueStats.pending}`);
    console.log(`🔄 Processing: ${queueStats.processing}`);
    console.log(`✅ Completed: ${queueStats.completed}`);
    console.log(`❌ Failed: ${queueStats.failed}`);

    if (queueStats.completed > 0) {
      const completionRate = (
        (queueStats.completed / queueStats.total_mentions) *
        100
      ).toFixed(1);
      console.log(`⚡ Completion Rate: ${completionRate}%`);
    }

    console.log(
      `🎯 Average Priority: ${
        queueStats.avg_priority ? queueStats.avg_priority.toFixed(1) : "N/A"
      }`
    );
    console.log(
      `📅 Latest Mention: ${
        queueStats.newest_mention
          ? new Date(queueStats.newest_mention).toLocaleString()
          : "N/A"
      }`
    );
  } else {
    console.log("📭 Queue is empty");
  }

  console.log("\n🔗 CHECKPOINT STATUS");
  console.log("═══════════════════");
  console.log(`📍 Last Since ID: ${checkpoint?.value || "Not set"}`);

  console.log("\n⚡ RATE LIMIT STATUS (Hourly)");
  console.log("════════════════════════════");
  if (rateLimits.length > 0) {
    rateLimits.forEach((limit) => {
      const endpoint = limit.endpoint.padEnd(15);
      const used = limit.requests_used || 0;
      const windowStart = new Date(limit.window_start).toLocaleTimeString();
      console.log(`${endpoint}: ${used} requests used (since ${windowStart})`);
    });
  } else {
    console.log("📊 No rate limit data available");
  }

  // Show recent activity (last 5 processed mentions)
  const recentActivity = db.database
    .prepare(
      `
    SELECT mention_id, author_username, status, processed_at
    FROM pending_mentions 
    WHERE status = 'completed' 
    ORDER BY processed_at DESC 
    LIMIT 5
  `
    )
    .all();

  if (recentActivity.length > 0) {
    console.log("\n🕒 RECENT ACTIVITY (Last 5 processed)");
    console.log("═══════════════════════════════════");
    recentActivity.forEach((activity) => {
      const processedTime = new Date(
        activity.processed_at
      ).toLocaleTimeString();
      console.log(
        `✅ @${activity.author_username} (${activity.mention_id}) - ${processedTime}`
      );
    });
  }

  // Show pending mentions by priority
  const pendingByPriority = db.database
    .prepare(
      `
    SELECT priority, COUNT(*) as count
    FROM pending_mentions 
    WHERE status = 'pending'
    GROUP BY priority 
    ORDER BY priority
  `
    )
    .all();

  if (pendingByPriority.length > 0) {
    console.log("\n⏳ PENDING BY PRIORITY");
    console.log("════════════════════");
    pendingByPriority.forEach((p) => {
      console.log(`Priority ${p.priority}: ${p.count} mentions`);
    });
  }

  console.log("\n✅ Status check complete!");
} catch (error) {
  console.error("❌ Error checking queue status:", error.message);
  console.error(
    "\n💡 Make sure the project is built (npm run build) and database exists"
  );
  process.exit(1);
}
