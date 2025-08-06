// Level 3: GameFunction - Store Candidate Tweet
import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import appLogger from "../../../lib/log";
import { CandidateTweet } from "../../../lib/db";
import GlitchBotDB from "../../../lib/db";

// Storage criteria interface
export interface StorageCriteria {
  min_score: number; // Minimum combined score required
  min_engagement: number; // Minimum engagement threshold
  min_author_followers: number; // Minimum author follower count
  store_trending_keywords: boolean; // Store if contains trending topics
}

// Default storage criteria
const DEFAULT_CRITERIA: StorageCriteria = {
  min_score: 10, // High-quality content threshold (reduced from 12)
  min_engagement: 50, // At least 50 total interactions (reduced from 100)
  min_author_followers: 500, // At least 500 followers (reduced from 1000)
  store_trending_keywords: true,
};

// Check if tweet meets storage criteria
function meetsCriteria(
  candidateTweet: any,
  analysis: any,
  criteria: StorageCriteria = DEFAULT_CRITERIA
): { shouldStore: boolean; reason: string } {
  const reasons: string[] = [];
  let shouldStore = false;

  // Primary criterion: Content score
  if (analysis.combined_score >= criteria.min_score) {
    shouldStore = true;
    reasons.push(
      `high score (${analysis.combined_score}/${criteria.min_score})`
    );
  }

  // Secondary criteria can also trigger storage
  const totalEngagement = candidateTweet.public_metrics
    ? (candidateTweet.public_metrics.retweet_count || 0) +
      (candidateTweet.public_metrics.like_count || 0) +
      (candidateTweet.public_metrics.reply_count || 0) +
      (candidateTweet.public_metrics.quote_count || 0)
    : 0;

  if (totalEngagement >= criteria.min_engagement) {
    shouldStore = true;
    reasons.push(`viral engagement (${totalEngagement})`);
  }

  const authorFollowers =
    candidateTweet.author?.public_metrics?.followers_count || 0;
  if (
    authorFollowers >= criteria.min_author_followers &&
    analysis.combined_score >= 10
  ) {
    shouldStore = true;
    reasons.push(`authority + quality (${authorFollowers} followers)`);
  }

  // Trending keywords override (if enabled)
  if (criteria.store_trending_keywords && analysis.referenced_score >= 8) {
    const tweetText = candidateTweet.text || "";
    const trendingPatterns = [
      /breaking/i,
      /announcement/i,
      /launches?/i,
      /reveals?/i,
      /bitcoin/i,
      /ethereum/i,
      /ai/i,
      /gpt/i,
      /chatgpt/i,
    ];

    const hasTrending = trendingPatterns.some((pattern) =>
      pattern.test(tweetText)
    );
    if (hasTrending) {
      shouldStore = true;
      reasons.push("trending keywords");
    }
  }

  const reason = shouldStore
    ? `Store: ${reasons.join(", ")}`
    : `Skip: score ${analysis.combined_score} < ${criteria.min_score}, engagement ${totalEngagement} < ${criteria.min_engagement}`;

  return { shouldStore, reason };
}

// Prepare candidate tweet object for database storage
function prepareCandidateTweet(
  referencedTweet: any,
  referencedAuthor: any,
  mentionId: string,
  analysis: any
): CandidateTweet {
  const candidateTweet: CandidateTweet = {
    tweet_id: referencedTweet.id,
    author_id: referencedTweet.author_id,
    author_username:
      referencedAuthor?.username || `user_${referencedTweet.author_id}`,
    content: referencedTweet.text,
    created_at: referencedTweet.created_at,
    discovered_via_mention_id: mentionId,
    discovery_timestamp: new Date().toISOString(),
    curation_score: analysis.combined_score,
  };

  // Serialize public metrics as JSON string if available
  if (referencedTweet.public_metrics) {
    candidateTweet.public_metrics = JSON.stringify(
      referencedTweet.public_metrics
    );
  }

  return candidateTweet;
}

// Main storage function
export const storeCandidateTweetFunction = new GameFunction({
  name: "store_candidate_tweet",
  description:
    "Store high-quality referenced tweets in candidate_tweets table with intelligent filtering",
  args: [
    {
      name: "referenced_tweet",
      description: "Referenced tweet data from includes",
    },
    { name: "referenced_author", description: "Referenced tweet author data" },
    {
      name: "mention_id",
      description: "ID of the mention that discovered this tweet",
    },
    {
      name: "content_analysis",
      description: "Analysis result from score_content",
    },
    {
      name: "storage_criteria",
      description: "Optional custom storage criteria",
    },
  ] as const,
  executable: async (args, logger) => {
    try {
      const startTime = Date.now();

      logger("Starting candidate tweet storage evaluation...");

      // Validate required arguments
      if (
        !args.referenced_tweet ||
        !args.mention_id ||
        !args.content_analysis
      ) {
        throw new Error(
          "Missing required arguments: referenced_tweet, mention_id, or content_analysis"
        );
      }

      // Parse arguments (they come as strings from GameFunction)
      const referencedTweet =
        typeof args.referenced_tweet === "string"
          ? JSON.parse(args.referenced_tweet)
          : args.referenced_tweet;
      const referencedAuthor = args.referenced_author
        ? typeof args.referenced_author === "string"
          ? JSON.parse(args.referenced_author)
          : args.referenced_author
        : null;
      const mentionId = args.mention_id;
      const analysis =
        typeof args.content_analysis === "string"
          ? JSON.parse(args.content_analysis)
          : args.content_analysis;

      const customCriteria = args.storage_criteria
        ? typeof args.storage_criteria === "string"
          ? JSON.parse(args.storage_criteria)
          : args.storage_criteria
        : DEFAULT_CRITERIA;

      // Evaluate storage criteria
      const evaluation = meetsCriteria(
        { ...referencedTweet, author: referencedAuthor },
        analysis,
        customCriteria
      );

      appLogger.info(
        {
          tweet_id: referencedTweet.id,
          author_username: referencedAuthor?.username,
          combined_score: analysis.combined_score,
          should_store: evaluation.shouldStore,
          reason: evaluation.reason,
        },
        "Candidate tweet storage evaluation"
      );

      if (!evaluation.shouldStore) {
        logger(`Skipping storage: ${evaluation.reason}`);
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Done,
          JSON.stringify({
            stored: false,
            reason: evaluation.reason,
            tweet_id: referencedTweet.id,
            score: analysis.combined_score,
          })
        );
      }

      // Prepare candidate tweet for storage
      const candidateTweet = prepareCandidateTweet(
        referencedTweet,
        referencedAuthor,
        mentionId,
        analysis
      );

      // Initialize database and check for duplicates
      const db = new GlitchBotDB();

      if (db.candidateTweetExists(candidateTweet.tweet_id)) {
        logger(
          `Tweet ${candidateTweet.tweet_id} already stored, skipping duplicate`
        );

        appLogger.info(
          {
            tweet_id: candidateTweet.tweet_id,
            action: "duplicate_skipped",
          },
          "Candidate tweet already exists"
        );

        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Done,
          JSON.stringify({
            stored: false,
            reason: "duplicate_tweet_already_stored",
            tweet_id: candidateTweet.tweet_id,
            score: analysis.combined_score,
          })
        );
      }

      // Store candidate tweet in database
      try {
        db.addCandidateTweet(candidateTweet);

        const executionTime = Date.now() - startTime;

        appLogger.info(
          {
            tweet_id: candidateTweet.tweet_id,
            author_username: candidateTweet.author_username,
            curation_score: candidateTweet.curation_score,
            execution_time_ms: executionTime,
            action: "stored_successfully",
          },
          "Candidate tweet stored in database"
        );

        logger(
          `Candidate tweet stored successfully: ${candidateTweet.tweet_id} (score: ${candidateTweet.curation_score})`
        );

        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Done,
          JSON.stringify({
            stored: true,
            candidate_tweet: candidateTweet,
            reason: evaluation.reason,
            execution_time_ms: executionTime,
            database_action: "inserted",
          })
        );
      } catch (dbError: any) {
        const executionTime = Date.now() - startTime;

        appLogger.error(
          {
            tweet_id: candidateTweet.tweet_id,
            error: dbError.message,
            execution_time_ms: executionTime,
          },
          "Failed to store candidate tweet in database"
        );

        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          `Database storage failed: ${dbError.message}`
        );
      }
    } catch (error: any) {
      appLogger.error(
        { error: error.message },
        "Candidate tweet storage evaluation failed"
      );
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Storage evaluation failed: ${error.message}`
      );
    }
  },
});

// Export utility functions for direct use
export { meetsCriteria, prepareCandidateTweet, DEFAULT_CRITERIA };

export default storeCandidateTweetFunction;
