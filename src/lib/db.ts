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
  tweet_id: string; // Original tweet ID (not mention ID)
  author_id: string; // Original author ID
  author_username: string; // Original author username
  content: string; // Original tweet text
  created_at: string; // Original tweet timestamp
  public_metrics?: string; // Engagement data (JSON string)
  discovered_via_mention_id: string; // Which mention led us to this
  discovery_timestamp: string; // When we found it
  curation_score: number; // Content quality score (0-20)
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
    const stmt = this.dbManager.database.prepare(
      "SELECT value FROM cadence WHERE key = ?"
    );
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

  // Candidate tweet methods for Phase 2B storage

  // Add candidate tweet with full metadata
  addCandidateTweet(candidateTweet: CandidateTweet): void {
    const stmt = this.dbManager.database.prepare(`
      INSERT OR REPLACE INTO candidate_tweets (
        tweet_id, author_id, author_username, content, created_at,
        public_metrics, discovered_via_mention_id, discovery_timestamp, curation_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      candidateTweet.tweet_id,
      candidateTweet.author_id,
      candidateTweet.author_username,
      candidateTweet.content,
      candidateTweet.created_at,
      candidateTweet.public_metrics,
      candidateTweet.discovered_via_mention_id,
      candidateTweet.discovery_timestamp,
      candidateTweet.curation_score
    );

    logger.info(
      {
        tweet_id: candidateTweet.tweet_id,
        author: candidateTweet.author_username,
        score: candidateTweet.curation_score,
      },
      "Candidate tweet stored successfully"
    );
  }

  // Get best candidate tweets by score
  getBestCandidateTweets(limit: number = 10): CandidateTweet[] {
    const stmt = this.dbManager.database.prepare(`
      SELECT * FROM candidate_tweets 
      WHERE tweet_id NOT IN (SELECT tweet_id FROM engaged_tweets)
      ORDER BY curation_score DESC, discovery_timestamp DESC
      LIMIT ?
    `);
    return stmt.all(limit) as CandidateTweet[];
  }

  // Get candidate tweet by ID
  getCandidateTweet(tweetId: string): CandidateTweet | null {
    const stmt = this.dbManager.database.prepare(
      "SELECT * FROM candidate_tweets WHERE tweet_id = ?"
    );
    return stmt.get(tweetId) as CandidateTweet | null;
  }

  // Check if candidate tweet already exists
  candidateTweetExists(tweetId: string): boolean {
    const stmt = this.dbManager.database.prepare(
      "SELECT 1 FROM candidate_tweets WHERE tweet_id = ?"
    );
    return !!stmt.get(tweetId);
  }

  // Remove processed candidate
  removeCandidateTweet(tweetId: string): void {
    const stmt = this.dbManager.database.prepare(
      "DELETE FROM candidate_tweets WHERE tweet_id = ?"
    );
    const result = stmt.run(tweetId);
    logger.debug(
      { tweet_id: tweetId, deleted: result.changes },
      "Candidate tweet removed"
    );
  }

  // Get candidate tweet statistics
  getCandidateStats(): {
    total: number;
    high_quality: number;
    avg_score: number;
  } {
    const stmt = this.dbManager.database.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN curation_score >= 15 THEN 1 END) as high_quality,
        AVG(curation_score) as avg_score
      FROM candidate_tweets
    `);
    return stmt.get() as {
      total: number;
      high_quality: number;
      avg_score: number;
    };
  }

  // Clean old records (older than 7 days)
  cleanup(): void {
    const weekAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const cleanEngaged = this.dbManager.database.prepare(
      "DELETE FROM engaged_tweets WHERE engaged_at < ?"
    );
    const cleanCandidates = this.dbManager.database.prepare(
      "DELETE FROM candidate_tweets WHERE discovery_timestamp < ?"
    );

    const engagedDeleted = cleanEngaged.run(weekAgo).changes;
    const candidatesDeleted = cleanCandidates.run(weekAgo).changes;

    logger.info(
      { engagedDeleted, candidatesDeleted },
      "Database cleanup completed for engaged_tweets and candidate_tweets"
    );
  }

  // Close database connection
  close(): void {
    this.dbManager.database.close();
    logger.info("Database connection closed");
  }
}

export default GlitchBotDB;
