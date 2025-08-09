#!/usr/bin/env node

const path = require("path");
const fs = require("fs");

// Add the dist directory to the path for imports
const projectRoot = path.join(__dirname, "..");
const distPath = path.join(projectRoot, "dist");

// Import the database class
const GlitchBotDB = require(path.join(distPath, "lib", "db.js")).default;

function stringifyValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_e) {
      return String(value);
    }
  }
  return String(value);
}

function computeColumnWidths(columns, rows) {
  const widths = columns.map((c) => c.length);
  for (const row of rows) {
    columns.forEach((col, idx) => {
      const val = stringifyValue(row[col]);
      if (val.length > widths[idx]) widths[idx] = val.length;
    });
  }
  // Cap insanely long columns to keep table readable
  return widths.map((w) => Math.min(w, 120));
}

function printTable(columns, rows) {
  const widths = computeColumnWidths(columns, rows);

  const sep = "┌" + widths.map((w) => "".padEnd(w + 2, "─")).join("┬") + "┐";
  const mid = "├" + widths.map((w) => "".padEnd(w + 2, "─")).join("┼") + "┤";
  const end = "└" + widths.map((w) => "".padEnd(w + 2, "─")).join("┴") + "┘";

  const header =
    "│ " +
    columns.map((c, i) => c.toString().padEnd(widths[i], " ")).join(" │ ") +
    " │";

  console.log(sep);
  console.log(header);
  console.log(mid);

  if (rows.length === 0) {
    const empty =
      "│ " +
      columns.map((_, i) => "".padEnd(widths[i], " ")).join(" │ ") +
      " │";
    console.log(empty);
  } else {
    for (const row of rows) {
      const line =
        "│ " +
        columns
          .map((c, i) =>
            stringifyValue(row[c]).slice(0, widths[i]).padEnd(widths[i], " ")
          )
          .join(" │ ") +
        " │";
      console.log(line);
    }
  }

  console.log(end);
}

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

    // Get table schema (standardized table)
    const schema = db.database.prepare(`PRAGMA table_info(${tableName})`).all();
    console.log("\n🏗️  Schema:");
    const schemaCols = ["name", "type", "notnull", "dflt_value", "pk"];
    printTable(schemaCols, schema);

    // Get row count
    const count = db.database
      .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
      .get();
    console.log(`\n📊 Row Count: ${count.count}`);

    // Get table contents (limit to 10 rows for readability), standardized table
    if (count.count > 0) {
      const rows = db.database
        .prepare(`SELECT * FROM ${tableName} LIMIT 10`)
        .all();
      console.log("\n📋 Contents (showing first 10 rows):");
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      printTable(columns, rows);
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
