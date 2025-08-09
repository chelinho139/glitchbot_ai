import Database from "better-sqlite3";
import logger from "./log";
import { DatabaseManager, databaseManager } from "./database-manager";

export interface EngagedMention {
  mention_id: string;
  engaged_at: string;
  action: "reply" | "like";
}

export interface EngagedQuote {
  tweet_id: string;
  engaged_at: string;
  action: "quote";
}

export interface CadenceRecord {
  key: string;
  value: string;
}

export interface SuggestedTweet {
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

export interface PendingMentionRow {
  mention_id: string;
  author_id: string;
  author_username: string;
  text: string;
  created_at: string;
  status: string;
  priority: number;
  retry_count: number;
  original_fetch_id: string;
  fetched_at: string;
  processed_at?: string;
  referenced_tweets?: string;
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

  // Check if a mention was already engaged with
  isMentionEngaged(mentionId: string): boolean {
    const stmt = this.dbManager.database.prepare(
      "SELECT 1 FROM engaged_mentions WHERE mention_id = ?"
    );
    return !!stmt.get(mentionId);
  }

  // Record engagement with a mention
  recordMentionEngagement(mentionId: string, action: "reply" | "like"): void {
    const stmt = this.dbManager.database.prepare(
      "INSERT OR IGNORE INTO engaged_mentions (mention_id, action) VALUES (?, ?)"
    );
    stmt.run(mentionId, action);
  }

  // Check if a tweet was already quoted
  isTweetQuoted(tweetId: string): boolean {
    const stmt = this.dbManager.database.prepare(
      "SELECT 1 FROM engaged_quotes WHERE tweet_id = ?"
    );
    return !!stmt.get(tweetId);
  }

  // Record quote engagement with a tweet
  recordQuoteEngagement(tweetId: string): void {
    const stmt = this.dbManager.database.prepare(
      "INSERT OR IGNORE INTO engaged_quotes (tweet_id, action) VALUES (?, 'quote')"
    );
    stmt.run(tweetId);
  }

  // Legacy method for backward compatibility - checks both tables
  isEngaged(tweetId: string): boolean {
    return this.isMentionEngaged(tweetId) || this.isTweetQuoted(tweetId);
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

  // Timeline state management methods

  // Get timeline state value (e.g., last_newest_id, last_next_token)
  getTimelineState(key: string): string | null {
    const stmt = this.dbManager.database.prepare(
      "SELECT value FROM timeline_state WHERE key = ?"
    );
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value || null;
  }

  // Mention state management methods

  getMentionState(key: string): string | null {
    const stmt = this.dbManager.database.prepare(
      "SELECT value FROM mention_state WHERE key = ?"
    );
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value || null;
  }

  setMentionState(key: string, value: string): void {
    const now = new Date().toISOString();
    const stmt = this.dbManager.database.prepare(
      "INSERT OR REPLACE INTO mention_state (key, value, updated_at) VALUES (?, ?, ?)"
    );
    stmt.run(key, value, now);
  }

  getLastMentionSinceId(): string | null {
    return this.getMentionState("last_since_id");
  }

  setMentionCheckpoint(newestId: string): void {
    const now = new Date().toISOString();
    const setStmt = this.dbManager.database.prepare(
      "INSERT OR REPLACE INTO mention_state (key, value, updated_at) VALUES (?, ?, ?)"
    );
    setStmt.run("last_since_id", newestId, now);
    setStmt.run("last_fetch_time", now, now);
  }

  // Set timeline state value
  setTimelineState(key: string, value: string): void {
    const stmt = this.dbManager.database.prepare(
      "INSERT OR REPLACE INTO timeline_state (key, value, updated_at) VALUES (?, ?, ?)"
    );
    const now = new Date().toISOString();
    stmt.run(key, value, now);
  }

  // Clear timeline state (useful for resetting pagination)
  clearTimelineState(key: string): void {
    const stmt = this.dbManager.database.prepare(
      "DELETE FROM timeline_state WHERE key = ?"
    );
    stmt.run(key);
  }

  // Suggested tweet methods for Phase 2B storage

  // Add suggested tweet with full metadata
  addSuggestedTweet(suggestedTweet: SuggestedTweet): void {
    const stmt = this.dbManager.database.prepare(`
      INSERT OR REPLACE INTO suggested_tweets (
        tweet_id, author_id, author_username, content, created_at,
        public_metrics, discovered_via_mention_id, discovery_timestamp, curation_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      suggestedTweet.tweet_id,
      suggestedTweet.author_id,
      suggestedTweet.author_username,
      suggestedTweet.content,
      suggestedTweet.created_at,
      suggestedTweet.public_metrics,
      suggestedTweet.discovered_via_mention_id,
      suggestedTweet.discovery_timestamp,
      suggestedTweet.curation_score
    );

    logger.info(
      {
        tweet_id: suggestedTweet.tweet_id,
        author: suggestedTweet.author_username,
        score: suggestedTweet.curation_score,
      },
      "Suggested tweet stored successfully"
    );
  }

  /**
   * Get recent suggested tweet rows discovered via mentions within the last `windowHours`.
   * Falls back to discovery_timestamp window if mention join yields no rows.
   * Excludes tweets already in engaged_quotes.
   */
  getRecentSuggestedTweetRowsByMentionWindow(
    windowHours: number,
    limit: number
  ): Array<{
    tweet_id: string;
    author_id: string;
    author_username: string;
    content: string;
    created_at: string;
    public_metrics?: string;
    discovered_via_mention_id: string;
  }> {
    const cutoffIso = new Date(
      Date.now() - windowHours * 60 * 60 * 1000
    ).toISOString();

    // Primary: join with pending_mentions to ensure mention is within window
    const selectSuggestions = this.dbManager.database.prepare(
      `
        SELECT 
          st.tweet_id,
          st.author_id,
          st.author_username,
          st.content,
          st.created_at,
          st.public_metrics,
          st.discovered_via_mention_id
        FROM suggested_tweets st
        JOIN pending_mentions pm 
          ON pm.mention_id = st.discovered_via_mention_id
        WHERE pm.created_at >= ?
          AND st.tweet_id NOT IN (SELECT tweet_id FROM engaged_quotes)
        ORDER BY pm.created_at DESC
        LIMIT ?
      `
    );

    let rows = selectSuggestions.all(cutoffIso, limit) as any[];

    // Fallback: use discovery_timestamp window
    if (!rows || rows.length === 0) {
      const fallbackSelect = this.dbManager.database.prepare(
        `
          SELECT 
            st.tweet_id,
            st.author_id,
            st.author_username,
            st.content,
            st.created_at,
            st.public_metrics,
            st.discovered_via_mention_id
          FROM suggested_tweets st
          WHERE st.discovery_timestamp >= ?
            AND st.tweet_id NOT IN (SELECT tweet_id FROM engaged_quotes)
          ORDER BY st.discovery_timestamp DESC
          LIMIT ?
        `
      );
      rows = fallbackSelect.all(cutoffIso, limit) as any[];
    }

    return (rows || []).map((r) => ({
      tweet_id: String(r.tweet_id),
      author_id: String(r.author_id),
      author_username: String(r.author_username),
      content: String(r.content),
      created_at: String(r.created_at),
      public_metrics: r.public_metrics,
      discovered_via_mention_id: String(r.discovered_via_mention_id),
    }));
  }

  // Query helpers for mentions and suggestions

  getPendingMentions(status: string, limit: number): PendingMentionRow[] {
    const stmt = this.dbManager.database.prepare(
      `
        SELECT 
          mention_id,
          author_id,
          author_username,
          text,
          created_at,
          status,
          priority,
          retry_count,
          original_fetch_id,
          fetched_at,
          processed_at,
          referenced_tweets
        FROM pending_mentions 
        WHERE status = ?
        ORDER BY priority DESC, created_at ASC
        LIMIT ?
      `
    );
    return stmt.all(status, limit) as PendingMentionRow[];
  }

  getSuggestedTweetsForMentions(
    mentionIds: string[]
  ): Array<SuggestedTweet & { discovered_via_mention_id: string }> {
    if (mentionIds.length === 0) return [];
    const placeholders = mentionIds.map(() => "?").join(",");
    const stmt = this.dbManager.database.prepare(
      `
        SELECT 
          tweet_id,
          author_id,
          author_username,
          content,
          created_at,
          public_metrics,
          curation_score,
          discovery_timestamp,
          discovered_via_mention_id
        FROM suggested_tweets 
        WHERE discovered_via_mention_id IN (${placeholders})
        ORDER BY discovery_timestamp DESC
      `
    );
    return stmt.all(...mentionIds) as Array<
      SuggestedTweet & { discovered_via_mention_id: string }
    >;
  }

  getPendingStats(): { total: number; pending: number; processing: number } {
    const stmt = this.dbManager.database.prepare(
      `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing
        FROM pending_mentions
      `
    );
    const row = stmt.get() as any;
    return {
      total: row?.total || 0,
      pending: row?.pending || 0,
      processing: row?.processing || 0,
    };
  }

  getPendingMentionById(mentionId: string): PendingMentionRow | null {
    const stmt = this.dbManager.database.prepare(
      `
        SELECT 
          mention_id,
          author_id,
          author_username,
          text,
          created_at,
          status,
          priority,
          retry_count,
          original_fetch_id,
          fetched_at,
          processed_at,
          referenced_tweets
        FROM pending_mentions
        WHERE mention_id = ?
      `
    );
    return (stmt.get(mentionId) as PendingMentionRow) || null;
  }

  markMentionProcessed(
    mentionId: string,
    processedAtIso: string,
    workerId: string
  ): void {
    this.dbManager.database
      .prepare(
        `
          UPDATE pending_mentions 
          SET status = 'completed', processed_at = ?, worker_id = ?
          WHERE mention_id = ?
        `
      )
      .run(processedAtIso, workerId, mentionId);
  }

  // Get best suggested tweets by score (excluding already quoted tweets)
  getBestSuggestedTweets(limit: number = 10): SuggestedTweet[] {
    const stmt = this.dbManager.database.prepare(`
      SELECT * FROM suggested_tweets 
      WHERE tweet_id NOT IN (SELECT tweet_id FROM engaged_quotes)
      ORDER BY curation_score DESC, discovery_timestamp DESC
      LIMIT ?
    `);
    return stmt.all(limit) as SuggestedTweet[];
  }

  // Get suggested tweet by ID
  getSuggestedTweet(tweetId: string): SuggestedTweet | null {
    const stmt = this.dbManager.database.prepare(
      "SELECT * FROM suggested_tweets WHERE tweet_id = ?"
    );
    return stmt.get(tweetId) as SuggestedTweet | null;
  }

  // Check if suggested tweet already exists
  suggestedTweetExists(tweetId: string): boolean {
    const stmt = this.dbManager.database.prepare(
      "SELECT 1 FROM suggested_tweets WHERE tweet_id = ?"
    );
    return !!stmt.get(tweetId);
  }

  // Remove processed suggested tweet
  removeSuggestedTweet(tweetId: string): void {
    const stmt = this.dbManager.database.prepare(
      "DELETE FROM suggested_tweets WHERE tweet_id = ?"
    );
    const result = stmt.run(tweetId);
    logger.debug(
      { tweet_id: tweetId, deleted: result.changes },
      "Suggested tweet removed"
    );
  }

  // Get suggested tweet statistics
  getSuggestedStats(): {
    total: number;
    high_quality: number;
    avg_score: number;
  } {
    const stmt = this.dbManager.database.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN curation_score >= 15 THEN 1 END) as high_quality,
        AVG(curation_score) as avg_score
      FROM suggested_tweets
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

    const cleanEngagedMentions = this.dbManager.database.prepare(
      "DELETE FROM engaged_mentions WHERE engaged_at < ?"
    );
    const cleanEngagedQuotes = this.dbManager.database.prepare(
      "DELETE FROM engaged_quotes WHERE engaged_at < ?"
    );
    const cleanCandidates = this.dbManager.database.prepare(
      "DELETE FROM suggested_tweets WHERE discovery_timestamp < ?"
    );

    const mentionsDeleted = cleanEngagedMentions.run(weekAgo).changes;
    const quotesDeleted = cleanEngagedQuotes.run(weekAgo).changes;
    const candidatesDeleted = cleanCandidates.run(weekAgo).changes;

    logger.info(
      { mentionsDeleted, quotesDeleted, candidatesDeleted },
      "Database cleanup completed for engaged_mentions, engaged_quotes and suggested_tweets"
    );
  }

  // Close database connection
  close(): void {
    this.dbManager.database.close();
    logger.info("Database connection closed");
  }
}

export default GlitchBotDB;
