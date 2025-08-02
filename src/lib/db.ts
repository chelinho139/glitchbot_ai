import Database from "better-sqlite3";
import logger from "./log";

export interface EngagedTweet {
  tweet_id: string;
  engaged_at: string;
  action: "reply" | "quote" | "like";
}

export interface CadenceRecord {
  key: string;
  value: string;
}

export interface CandidateTweet {
  tweet_id: string;
  discovered_at: string;
  score: number;
  reason: string;
}

class GlitchBotDB {
  private db: Database.Database;

  constructor(dbPath: string = "./glitchbot.db") {
    this.db = new Database(dbPath);
    this.init();
    logger.info({ dbPath }, "Database initialized");
  }

  private init(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma("journal_mode = WAL");

    // Create tables as per the schema in the documentation
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS engaged_tweets (
        tweet_id TEXT PRIMARY KEY,
        engaged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        action TEXT CHECK(action IN ('reply','quote','like')) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cadence (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS candidate_tweets (
        tweet_id TEXT PRIMARY KEY,
        discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        score REAL NOT NULL,
        reason TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_candidate_score ON candidate_tweets(score DESC);
      CREATE INDEX IF NOT EXISTS idx_engaged_at ON engaged_tweets(engaged_at);
    `);

    logger.info("Database schema initialized");
  }

  // Check if a tweet was already engaged with
  isEngaged(tweetId: string): boolean {
    const stmt = this.db.prepare(
      "SELECT 1 FROM engaged_tweets WHERE tweet_id = ?"
    );
    return !!stmt.get(tweetId);
  }

  // Record engagement with a tweet
  recordEngagement(tweetId: string, action: "reply" | "quote" | "like"): void {
    const stmt = this.db.prepare(
      "INSERT OR IGNORE INTO engaged_tweets (tweet_id, action) VALUES (?, ?)"
    );
    stmt.run(tweetId, action);
  }

  // Get cadence value (e.g., last_quote_ts, last_reply_ts)
  getCadence(key: string): string | null {
    const stmt = this.db.prepare("SELECT value FROM cadence WHERE key = ?");
    const result = stmt.get(key) as CadenceRecord | undefined;
    return result?.value || null;
  }

  // Set cadence value
  setCadence(key: string, value: string): void {
    const stmt = this.db.prepare(
      "INSERT OR REPLACE INTO cadence (key, value) VALUES (?, ?)"
    );
    stmt.run(key, value);
  }

  // Add candidate tweet
  addCandidate(tweetId: string, score: number, reason: string): void {
    const stmt = this.db.prepare(
      "INSERT OR REPLACE INTO candidate_tweets (tweet_id, score, reason) VALUES (?, ?, ?)"
    );
    stmt.run(tweetId, score, reason);
  }

  // Get best candidate tweet
  getBestCandidate(): CandidateTweet | null {
    const stmt = this.db.prepare(`
      SELECT tweet_id, discovered_at, score, reason 
      FROM candidate_tweets 
      WHERE tweet_id NOT IN (SELECT tweet_id FROM engaged_tweets)
      ORDER BY score DESC 
      LIMIT 1
    `);
    return stmt.get() as CandidateTweet | null;
  }

  // Remove processed candidate
  removeCandidate(tweetId: string): void {
    const stmt = this.db.prepare(
      "DELETE FROM candidate_tweets WHERE tweet_id = ?"
    );
    stmt.run(tweetId);
  }

  // Clean old records (older than 7 days)
  cleanup(): void {
    const weekAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const cleanEngaged = this.db.prepare(
      "DELETE FROM engaged_tweets WHERE engaged_at < ?"
    );
    const cleanCandidates = this.db.prepare(
      "DELETE FROM candidate_tweets WHERE discovered_at < ?"
    );

    const engagedDeleted = cleanEngaged.run(weekAgo).changes;
    const candidatesDeleted = cleanCandidates.run(weekAgo).changes;

    logger.info(
      { engagedDeleted, candidatesDeleted },
      "Database cleanup completed"
    );
  }

  // Close database connection
  close(): void {
    this.db.close();
    logger.info("Database connection closed");
  }
}

export default GlitchBotDB;
