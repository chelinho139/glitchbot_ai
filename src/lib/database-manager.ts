import Database from "better-sqlite3";
import appLogger from "./log";

/**
 * Centralized Database Manager
 *
 * Single point of control for all database initialization and schema management.
 * Replaces the scattered initialization across GlitchBotDB and GlobalRateLimiter.
 */
export class DatabaseManager {
  private db: Database.Database;
  private initialized = false;

  constructor(dbPath: string = "./glitchbot.db") {
    this.db = new Database(dbPath);
    this.initialize();
    appLogger.info({ dbPath }, "DatabaseManager initialized");
  }

  private initialize(): void {
    if (this.initialized) return;

    // Enable WAL mode for better concurrency
    this.db.pragma("journal_mode = WAL");

    appLogger.info("Starting centralized database initialization");

    // Initialize all schemas in logical order
    this.createCoreSchema();
    this.createQueueSchema();
    this.createRateLimitSchema();
    this.createEngagementSchema();
    this.createIndexes();

    this.initialized = true;
    appLogger.info("Database fully initialized with centralized schema");
  }

  /**
   * Core system tables for state management
   */
  private createCoreSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mention_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS cadence (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    appLogger.debug("Core schema created (mention_state, cadence)");
  }

  /**
   * Queue system tables for mention processing
   */
  private createQueueSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pending_mentions (
        mention_id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL,
        author_username TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),
        priority INTEGER DEFAULT 5,
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        intent_type TEXT,
        confidence REAL,
        original_fetch_id TEXT,
        worker_id TEXT,
        referenced_tweets TEXT
      );
    `);

    // Add referenced_tweets column to existing tables (migration)
    try {
      this.db.exec(
        `ALTER TABLE pending_mentions ADD COLUMN referenced_tweets TEXT`
      );
      appLogger.debug(
        "Added referenced_tweets column to pending_mentions table"
      );
    } catch (error: any) {
      // Column already exists or other error - that's fine
      appLogger.debug(
        "referenced_tweets column already exists or migration failed (this is expected)"
      );
    }

    appLogger.debug("Queue schema created (pending_mentions)");
  }

  /**
   * Rate limiting tables for API protection
   */
  private createRateLimitSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        endpoint TEXT NOT NULL,
        window_type TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        requests_used INTEGER DEFAULT 0,
        worker_usage TEXT DEFAULT '{}',
        twitter_reset_time INTEGER,
        PRIMARY KEY (endpoint, window_type, window_start)
      );
    `);
    appLogger.debug("Rate limit schema created (rate_limits)");
  }

  /**
   * Engagement tracking tables for duplicate prevention
   */
  private createEngagementSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS engaged_tweets (
        tweet_id TEXT PRIMARY KEY,
        engaged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        action TEXT CHECK(action IN ('reply','quote','like')) NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS candidate_tweets (
        tweet_id TEXT PRIMARY KEY,                -- Original tweet ID (not mention ID)
        author_id TEXT NOT NULL,                  -- Original author ID
        author_username TEXT NOT NULL,            -- Original author username
        content TEXT NOT NULL,                    -- Original tweet text
        created_at TEXT NOT NULL,                 -- Original tweet timestamp
        public_metrics TEXT,                      -- Engagement data (JSON)
        discovered_via_mention_id TEXT NOT NULL,  -- Which mention led us to this
        discovery_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        curation_score REAL DEFAULT 0            -- Content quality score (0-20)
      );
    `);
    appLogger.debug(
      "Engagement schema created (engaged_tweets, candidate_tweets)"
    );
  }

  /**
   * Create all database indexes for performance
   */
  private createIndexes(): void {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pending_status_priority 
        ON pending_mentions(status, priority, created_at);
      CREATE INDEX IF NOT EXISTS idx_pending_author 
        ON pending_mentions(author_id);
      CREATE INDEX IF NOT EXISTS idx_engaged_at 
        ON engaged_tweets(engaged_at);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_window 
        ON rate_limits(endpoint, window_type, window_start);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_reset
        ON rate_limits(endpoint, window_type, twitter_reset_time);
      CREATE INDEX IF NOT EXISTS idx_candidate_tweets_score
        ON candidate_tweets(curation_score DESC);
      CREATE INDEX IF NOT EXISTS idx_candidate_tweets_discovery
        ON candidate_tweets(discovery_timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_candidate_tweets_author
        ON candidate_tweets(author_id);
    `);
    appLogger.debug("Database indexes created");
  }

  /**
   * Get the underlying database instance
   */
  get database(): Database.Database {
    return this.db;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
    appLogger.info("Database connection closed");
  }

  /**
   * Get database statistics
   */
  getStats(): DatabaseStats {
    const tables = this.db
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' 
      ORDER BY name
    `
      )
      .all() as { name: string }[];

    const stats: DatabaseStats = {
      tableCount: tables.length,
      tables: tables.map((t) => t.name),
      initialized: this.initialized,
      walMode: this.db.pragma("journal_mode", { simple: true }) === "wal",
    };

    return stats;
  }
}

export interface DatabaseStats {
  tableCount: number;
  tables: string[];
  initialized: boolean;
  walMode: boolean;
}

// Export singleton instance for backward compatibility
export const databaseManager = new DatabaseManager();
