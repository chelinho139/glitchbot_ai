// Level 3: GameFunction - Get Pending Mentions
//
// Retrieves pending mentions from the database for worker processing
// This is part of the complete mentions processing workflow:
// 1. fetch-mentions: Fetches new mentions from Twitter API, stores in pending_mentions table,
//                    and automatically stores referenced tweets as candidate_tweets
// 2. get-pending-mentions: Retrieves list of pending mentions from DB WITH related candidate
//                          tweets context for informed worker responses
// 3. reply-mention: Posts reply to mention and marks it as completed in the database

import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import GlitchBotDB from "../../lib/db";
import appLogger from "../../lib/log";

// Define the structure for candidate tweet data
export interface CandidateTweet {
  tweet_id: string;
  author_id: string;
  author_username: string;
  content: string;
  created_at: string;
  public_metrics?: string; // JSON string
  curation_score?: number;
  discovery_timestamp: string;
}

// Define the structure for pending mention data with related candidate tweets
export interface PendingMention {
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
  referenced_tweets?: string; // JSON string of referenced tweets data
  candidate_tweets?: CandidateTweet[]; // Related candidate tweets discovered via this mention
}

export interface GetPendingMentionsResult {
  mentions: PendingMention[];
  total_count: number;
  pending_count: number;
  processing_count: number;
  candidate_tweets_count: number; // Total candidate tweets linked to these mentions
}

export const getPendingMentionsFunction = new GameFunction({
  name: "get_pending_mentions",
  description:
    "Retrieve pending mentions from database for worker processing with related candidate tweets context. Returns mentions sorted by priority (high to low) and creation time (oldest first), including any candidate tweets that were discovered via each mention. This provides full context about what content users shared when tagging @glitchbot_ai.",
  args: [
    {
      name: "limit",
      description:
        "Maximum number of mentions to retrieve (default: 10, max: 100)",
    },
    {
      name: "status",
      description:
        "Filter by status: 'pending', 'processing', 'completed', 'failed' (default: 'pending')",
    },
    {
      name: "include_stats",
      description: "Include statistics about total counts (default: true)",
    },
    {
      name: "include_candidate_tweets",
      description:
        "Include related candidate tweets for each mention (default: true)",
    },
  ] as const,
  executable: async (args, logger) => {
    const startTime = Date.now();

    try {
      logger("Retrieving pending mentions from database");
      appLogger.info(
        {
          limit: args.limit,
          status: args.status,
          include_stats: args.include_stats,
          include_candidate_tweets: args.include_candidate_tweets,
        },
        "get_pending_mentions: Starting operation"
      );

      // Parse and validate arguments
      const limit = Math.min(Math.max(parseInt(args.limit || "10"), 1), 100);
      const status = args.status || "pending";
      const includeStats = args.include_stats !== "false";
      const includeCandidateTweets = args.include_candidate_tweets !== "false";

      // Validate status
      const validStatuses = ["pending", "processing", "completed", "failed"];
      if (!validStatuses.includes(status)) {
        appLogger.error(
          { status, valid_statuses: validStatuses },
          "get_pending_mentions: Invalid status parameter"
        );
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          `Invalid status '${status}'. Must be one of: ${validStatuses.join(
            ", "
          )}`
        );
      }

      const db = new GlitchBotDB();

      // Get mentions with the specified status
      const mentions = db.database
        .prepare(
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
        )
        .all(status, limit) as PendingMention[];

      appLogger.info(
        {
          found_count: mentions.length,
          status,
          limit,
        },
        "get_pending_mentions: Retrieved mentions from database"
      );

      // Fetch related candidate tweets if requested
      let totalCandidateTweetsCount = 0;
      if (includeCandidateTweets && mentions.length > 0) {
        const mentionIds = mentions.map((m) => m.mention_id);

        // Get all candidate tweets discovered via these mentions
        const candidateTweets = db.database
          .prepare(
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
          FROM candidate_tweets 
          WHERE discovered_via_mention_id IN (${mentionIds
            .map(() => "?")
            .join(",")})
          ORDER BY discovery_timestamp DESC
        `
          )
          .all(...mentionIds) as (CandidateTweet & {
          discovered_via_mention_id: string;
        })[];

        totalCandidateTweetsCount = candidateTweets.length;

        // Group candidate tweets by mention ID
        const candidateTweetsByMention = new Map<string, CandidateTweet[]>();
        candidateTweets.forEach((tweet) => {
          const mentionId = tweet.discovered_via_mention_id;
          if (!candidateTweetsByMention.has(mentionId)) {
            candidateTweetsByMention.set(mentionId, []);
          }
          // Remove the discovered_via_mention_id from the tweet object before adding to mention
          const { discovered_via_mention_id, ...tweetWithoutMentionId } = tweet;
          candidateTweetsByMention.get(mentionId)!.push(tweetWithoutMentionId);
        });

        // Attach candidate tweets to their respective mentions
        mentions.forEach((mention) => {
          mention.candidate_tweets =
            candidateTweetsByMention.get(mention.mention_id) || [];
        });

        appLogger.info(
          {
            mentions_with_tweets: mentions.filter(
              (m) => m.candidate_tweets && m.candidate_tweets.length > 0
            ).length,
            total_candidate_tweets: totalCandidateTweetsCount,
          },
          "get_pending_mentions: Linked candidate tweets to mentions"
        );
      }

      // Get statistics if requested
      let totalCount = 0;
      let pendingCount = 0;
      let processingCount = 0;

      if (includeStats) {
        // Get count statistics
        const stats = db.database
          .prepare(
            `
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing
          FROM pending_mentions
        `
          )
          .get() as any;

        totalCount = stats.total || 0;
        pendingCount = stats.pending || 0;
        processingCount = stats.processing || 0;

        appLogger.debug(
          {
            total_count: totalCount,
            pending_count: pendingCount,
            processing_count: processingCount,
          },
          "get_pending_mentions: Retrieved database statistics"
        );
      }

      const executionTime = Date.now() - startTime;

      const result: GetPendingMentionsResult = {
        mentions,
        total_count: totalCount,
        pending_count: pendingCount,
        processing_count: processingCount,
        candidate_tweets_count: totalCandidateTweetsCount,
      };

      appLogger.info(
        {
          mentions_count: mentions.length,
          candidate_tweets_count: totalCandidateTweetsCount,
          mentions_with_context: mentions.filter(
            (m) => m.candidate_tweets && m.candidate_tweets.length > 0
          ).length,
          status,
          execution_time_ms: executionTime,
          total_count: totalCount,
          pending_count: pendingCount,
          include_candidate_tweets: includeCandidateTweets,
        },
        "get_pending_mentions: Operation completed with candidate tweet context"
      );

      logger(
        `Retrieved ${mentions.length} ${status} mentions with ${totalCandidateTweetsCount} related candidate tweets in ${executionTime}ms`
      );

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify(result)
      );
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      appLogger.error(
        {
          error: error.message,
          stack: error.stack,
          execution_time_ms: executionTime,
          limit: args.limit,
          status: args.status,
          include_candidate_tweets: args.include_candidate_tweets,
        },
        "get_pending_mentions: Unexpected error occurred"
      );

      logger(`Failed to retrieve pending mentions: ${error.message}`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Unexpected error: ${error.message}`
      );
    }
  },
});

export default getPendingMentionsFunction;
