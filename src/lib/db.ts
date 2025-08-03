import Database from "better-sqlite3";
import logger from "./log";
import { DatabaseManager, databaseManager } from "./database-manager";

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
  private dbManager: DatabaseManager;

  constructor(dbManager?: DatabaseManager) {
    // Use provided DatabaseManager or default singleton
    this.dbManager = dbManager || databaseManager;
    logger.info("GlitchBotDB initialized with centralized DatabaseManager");
  }

  // Public getter for database access (needed for specialized queries)
  get database(): Database.Database {
    return this.dbManager.database;
  }

  // Schema initialization now handled by DatabaseManager

  // Check if a tweet was already engaged with
  isEngaged(tweetId: string): boolean {
    const stmt = this.dbManager.database.prepare(
      "SELECT 1 FROM engaged_tweets WHERE tweet_id = ?"
    );
    return !!stmt.get(tweetId);
  }

  // Record engagement with a tweet
  recordEngagement(tweetId: string, action: "reply" | "quote" | "like"): void {
    const stmt = this.dbManager.database.prepare(
      "INSERT OR IGNORE INTO engaged_tweets (tweet_id, action) VALUES (?, ?)"
    );
    stmt.run(tweetId, action);
  }

  // Get cadence value (e.g., last_quote_ts, last_reply_ts)
  getCadence(key: string): string | null {
    const stmt = this.dbManager.database.prepare("SELECT value FROM cadence WHERE key = ?");
    const result = stmt.get(key) as CadenceRecord | undefined;
    return result?.value || null;
  }

  // Set cadence value
  setCadence(key: string, value: string): void {
    const stmt = this.dbManager.database.prepare(
      "INSERT OR REPLACE INTO cadence (key, value) VALUES (?, ?)"
    );
    stmt.run(key, value);
  }

  // Candidate tweet methods commented out until Phase 2 (DiscoveryWorker)
  // These will be uncommented when we implement the DiscoveryWorker

  /*
  // Add candidate tweet
  addCandidate(tweetId: string, score: number, reason: string): void {
    const stmt = this.dbManager.database.prepare(
      "INSERT OR REPLACE INTO candidate_tweets (tweet_id, score, reason) VALUES (?, ?, ?)"
    );
    stmt.run(tweetId, score, reason);
  }

  // Get best candidate tweet
  getBestCandidate(): CandidateTweet | null {
    const stmt = this.dbManager.database.prepare(`
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
    const stmt = this.dbManager.database.prepare(
      "DELETE FROM candidate_tweets WHERE tweet_id = ?"
    );
    stmt.run(tweetId);
  }
  */

  // Clean old records (older than 7 days)
  cleanup(): void {
    const weekAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const cleanEngaged = this.dbManager.database.prepare(
      "DELETE FROM engaged_tweets WHERE engaged_at < ?"
    );
    // cleanCandidates will be uncommented in Phase 2
    // const cleanCandidates = this.dbManager.database.prepare(
    //   "DELETE FROM candidate_tweets WHERE discovered_at < ?"
    // );

    const engagedDeleted = cleanEngaged.run(weekAgo).changes;
    // const candidatesDeleted = cleanCandidates.run(weekAgo).changes;

    logger.info(
      { engagedDeleted },
      "Database cleanup completed (candidate_tweets cleanup will be added in Phase 2)"
    );
  }

  // Close database connection
  close(): void {
    this.dbManager.database.close();
    logger.info("Database connection closed");
  }
}

export default GlitchBotDB;
