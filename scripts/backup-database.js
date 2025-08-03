#!/usr/bin/env node

/**
 * GlitchBot Database Backup Script
 *
 * Creates timestamped backups of the database for safety.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("💾 GlitchBot Database Backup");
console.log("============================");

function createBackup() {
  const dbPath = path.join(__dirname, "..", "glitchbot.db");
  const backupDir = path.join(__dirname, "..", "backups");

  try {
    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      console.log("⚠️  No database found to backup");
      console.log(
        `   Expected location: ${path.relative(process.cwd(), dbPath)}`
      );
      console.log("   Run the application first to create the database.");
      return;
    }

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log("📁 Created backups directory");
    }

    // Get database info
    const stats = fs.statSync(dbPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log("📊 Database info:");
    console.log(`   Size: ${sizeKB} KB`);
    console.log(`   Modified: ${stats.mtime.toLocaleString()}`);
    console.log("");

    // Create timestamped backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `glitchbot_${timestamp}.db`;
    const backupPath = path.join(backupDir, backupFileName);

    // Copy database file
    console.log("💾 Creating backup...");
    fs.copyFileSync(dbPath, backupPath);

    const backupStats = fs.statSync(backupPath);
    const backupSizeKB = (backupStats.size / 1024).toFixed(2);

    console.log("✅ Backup created successfully!");
    console.log(`   Location: ${path.relative(process.cwd(), backupPath)}`);
    console.log(`   Size: ${backupSizeKB} KB`);

    // Create SQL dump as well
    const sqlDumpPath = path.join(backupDir, `glitchbot_${timestamp}.sql`);

    try {
      console.log("📝 Creating SQL dump...");
      execSync(`sqlite3 "${dbPath}" .dump > "${sqlDumpPath}"`, {
        stdio: "pipe",
      });

      const sqlStats = fs.statSync(sqlDumpPath);
      const sqlSizeKB = (sqlStats.size / 1024).toFixed(2);

      console.log("✅ SQL dump created!");
      console.log(`   Location: ${path.relative(process.cwd(), sqlDumpPath)}`);
      console.log(`   Size: ${sqlSizeKB} KB`);
    } catch (sqlError) {
      console.warn("⚠️  Could not create SQL dump (sqlite3 not found)");
      console.warn("   Binary backup is still available");
    }

    // Show backup history
    console.log("");
    showBackupHistory(backupDir);

    // Cleanup old backups (keep last 10)
    cleanupOldBackups(backupDir);
  } catch (error) {
    console.error("❌ Backup failed:");
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

function showBackupHistory(backupDir) {
  try {
    const files = fs
      .readdirSync(backupDir)
      .filter(
        (file) =>
          file.startsWith("glitchbot_") &&
          (file.endsWith(".db") || file.endsWith(".sql"))
      )
      .map((file) => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: (stats.size / 1024).toFixed(2),
          modified: stats.mtime,
          type: file.endsWith(".db") ? "Binary" : "SQL",
        };
      })
      .sort((a, b) => b.modified - a.modified);

    if (files.length > 0) {
      console.log("📈 Backup history (most recent first):");
      console.log("");
      console.log("Date & Time           | Type   | Size    | Filename");
      console.log(
        "---------------------|--------|---------|-------------------------"
      );

      files.slice(0, 5).forEach((file) => {
        const date = file.modified.toLocaleString().padEnd(20);
        const type = file.type.padEnd(6);
        const size = `${file.size} KB`.padEnd(8);
        console.log(`${date} | ${type} | ${size} | ${file.name}`);
      });

      if (files.length > 5) {
        console.log(`... and ${files.length - 5} more backup(s)`);
      }
    }
  } catch (error) {
    console.warn("⚠️  Could not read backup history");
  }
}

function cleanupOldBackups(backupDir) {
  try {
    const maxBackups = 10;
    const files = fs
      .readdirSync(backupDir)
      .filter((file) => file.startsWith("glitchbot_") && file.endsWith(".db"))
      .map((file) => ({
        name: file,
        path: path.join(backupDir, file),
        modified: fs.statSync(path.join(backupDir, file)).mtime,
      }))
      .sort((a, b) => b.modified - a.modified);

    if (files.length > maxBackups) {
      const toDelete = files.slice(maxBackups);

      console.log("");
      console.log(
        `🧹 Cleaning up old backups (keeping ${maxBackups} most recent):`
      );

      toDelete.forEach((file) => {
        fs.unlinkSync(file.path);
        console.log(`   Deleted: ${file.name}`);

        // Also delete corresponding SQL dump if it exists
        const sqlPath = file.path.replace(".db", ".sql");
        if (fs.existsSync(sqlPath)) {
          fs.unlinkSync(sqlPath);
          console.log(`   Deleted: ${path.basename(sqlPath)}`);
        }
      });

      console.log(`✅ Cleaned up ${toDelete.length} old backup(s)`);
    }
  } catch (error) {
    console.warn("⚠️  Could not cleanup old backups:", error.message);
  }
}

// Show usage if help requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("💾 GlitchBot Database Backup Script");
  console.log("");
  console.log("Usage:");
  console.log(
    "  npm run db:backup              # Create backup with timestamp"
  );
  console.log("  node scripts/backup-database.js # Direct script execution");
  console.log("");
  console.log("Features:");
  console.log("  • Creates timestamped .db backup");
  console.log("  • Creates human-readable .sql dump");
  console.log("  • Shows backup history");
  console.log("  • Automatically cleans up old backups (keeps 10 most recent)");
  console.log("");
  console.log("Backup location: ./backups/");
  process.exit(0);
}

// Run the backup
createBackup();
