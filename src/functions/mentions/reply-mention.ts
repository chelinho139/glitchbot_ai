// Level 3: GameFunction - Reply to Mention
import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import { createRateLimitedTwitterClient } from "../../lib/rate-limited-twitter-client";
import appLogger from "../../lib/log";
import GlitchBotDB from "../../lib/db";
import { updateReplyTimestamp } from "../../lib/cadence";

export interface ReplyMentionResult {
  success: boolean;
  mention_id?: string;
  reply_id?: string;
  message?: string;
  processed?: boolean;
  stored_as_candidate?: boolean;
  storage_reason?: string;
}

export const replyMentionFunction = new GameFunction({
  name: "reply_mention",
  description:
    "Reply to a specific mention and mark it as processed in the database. This is the final step in the mentions workflow. Referenced tweets are automatically fetched and stored as candidate tweets during the mention fetch process, so this function focuses solely on posting the reply and updating the mention status to 'completed'.",
  args: [
    { name: "mention_id", description: "ID of mention/tweet to reply to" },
    { name: "reply_text", description: "The reply content (max 280 chars)" },
  ] as const,
  executable: async (args, logger) => {
    const startTime = Date.now();

    try {
      logger("Starting reply to mention");
      appLogger.info(
        {
          mention_id: args.mention_id,
          reply_length: args.reply_text?.length || 0,
        },
        "reply_mention: Starting operation"
      );

      // Validate inputs
      if (!args.mention_id || !args.reply_text) {
        appLogger.error("reply_mention: Missing required parameters");
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "mention_id and reply_text are required"
        );
      }

      if (args.reply_text.length > 280) {
        appLogger.error(
          { text_length: args.reply_text.length },
          "reply_mention: Reply text exceeds Twitter limit"
        );
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          `Reply text too long: ${args.reply_text.length}/280 characters`
        );
      }

      // Initialize Twitter client
      const gameToken = process.env.GAME_TWITTER_TOKEN;
      if (!gameToken) {
        appLogger.error("reply_mention: GAME_TWITTER_TOKEN not found");
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "GAME_TWITTER_TOKEN is required"
        );
      }

      const twitterClient = createRateLimitedTwitterClient({
        gameTwitterAccessToken: gameToken,
        workerId: "mentions-worker",
        defaultPriority: "high", // Replies have high priority
      });

      // Initialize database
      const db = new GlitchBotDB();

      // Post the reply
      let apiResponse;
      try {
        apiResponse = await twitterClient.v2.reply(
          args.reply_text,
          args.mention_id
        );

        appLogger.info(
          {
            original_mention_id: args.mention_id,
            reply_id: apiResponse.data.id,
            reply_text: args.reply_text,
          },
          "reply_mention: Reply posted successfully"
        );
      } catch (apiError: any) {
        // Handle Twitter API errors
        if (apiError.code === 429) {
          appLogger.warn(
            {
              error: apiError.message,
              mention_id: args.mention_id,
            },
            "reply_mention: Rate limit exceeded"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            "Rate limit exceeded for replies"
          );
        } else if (apiError.code >= 500) {
          appLogger.error(
            { error: apiError.message, code: apiError.code },
            "reply_mention: Twitter API server error"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Twitter server error: ${apiError.message}`
          );
        } else if (apiError.code === 401) {
          appLogger.error(
            { error: apiError.message },
            "reply_mention: Authentication failed"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Authentication failed: ${apiError.message}`
          );
        } else {
          // Log detailed Twitter API error information
          appLogger.error(
            {
              error: apiError.message,
              code: apiError.code,
              data: apiError.data || null,
              errors: apiError.errors || null,
              detail: apiError.detail || null,
              title: apiError.title || null,
              type: apiError.type || null,
              full_error: JSON.stringify(apiError, null, 2),
            },
            "reply_mention: Twitter API error with detailed response"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Twitter API error: ${apiError.message}${
              apiError.detail ? ` - ${apiError.detail}` : ""
            }`
          );
        }
      }

      // Store the mentioned tweet as a candidate tweet and mark mention as processed
      let processed = false;
      let storedAsCandidate = false;
      let storageReason = "";

      try {
        const now = new Date().toISOString();

        // Get full mention data from pending_mentions table
        const mention = db.database
          .prepare(
            `
          SELECT mention_id, author_id, author_username, text, created_at, status, referenced_tweets
          FROM pending_mentions 
          WHERE mention_id = ?
        `
          )
          .get(args.mention_id) as any;

        if (mention) {
          // Referenced tweets are now automatically stored during fetch-mentions
          // Just check if we have referenced tweets for logging purposes
          try {
            if (mention.referenced_tweets) {
              let referencedTweets;
              try {
                referencedTweets = JSON.parse(mention.referenced_tweets);
              } catch (parseError) {
                referencedTweets = null;
              }

              if (
                referencedTweets &&
                Array.isArray(referencedTweets) &&
                referencedTweets.length > 0
              ) {
                storedAsCandidate = true;
                storageReason = "referenced_tweets_stored_during_fetch";
                appLogger.info(
                  {
                    mention_id: mention.mention_id,
                    referenced_tweet_count: referencedTweets.length,
                    referenced_tweet_ids: referencedTweets.map((rt) => rt.id),
                  },
                  "reply_mention: Referenced tweets were already stored during fetch"
                );
              } else {
                storageReason = "no_referenced_tweets_found";
                appLogger.info(
                  { mention_id: mention.mention_id },
                  "reply_mention: No referenced tweets found in mention"
                );
              }
            } else {
              storageReason = "no_referenced_tweets_data";
              appLogger.info(
                { mention_id: mention.mention_id },
                "reply_mention: No referenced_tweets data found in mention"
              );
            }
          } catch (storageError: any) {
            storageReason = `storage_failed: ${storageError.message}`;
            appLogger.error(
              {
                mention_id: mention.mention_id,
                error: storageError.message,
              },
              "reply_mention: Failed to store mentioned tweet as candidate"
            );
            // Don't fail the function since the reply was successful
          }

          // Update pending_mentions table
          db.database
            .prepare(
              `
            UPDATE pending_mentions 
            SET status = 'completed', 
                processed_at = ?,
                worker_id = 'mentions-worker'
            WHERE mention_id = ?
          `
            )
            .run(now, args.mention_id);

          // Add to engaged_mentions table for tracking
          db.recordMentionEngagement(args.mention_id, "reply");

          // Update reply timestamp for cadence tracking
          updateReplyTimestamp(db);

          processed = true;
          appLogger.info(
            {
              mention_id: args.mention_id,
              reply_id: apiResponse.data.id,
              previous_status: mention.status,
              stored_as_candidate: storedAsCandidate,
              storage_reason: storageReason,
            },
            "reply_mention: Mention marked as processed successfully"
          );
        } else {
          storageReason = "mention_not_found_in_pending_queue";
          appLogger.warn(
            { mention_id: args.mention_id },
            "reply_mention: Mention not found in pending queue, but reply was successful"
          );
        }
      } catch (processingError: any) {
        storageReason = `processing_failed: ${processingError.message}`;
        appLogger.error(
          {
            mention_id: args.mention_id,
            reply_id: apiResponse.data.id,
            error: processingError.message,
          },
          "reply_mention: Failed to mark mention as processed, but reply was successful"
        );
        // Don't fail the function since the reply was successful
      }

      const executionTime = Date.now() - startTime;
      const result: ReplyMentionResult = {
        success: true,
        mention_id: args.mention_id,
        reply_id: apiResponse.data.id,
        message: "Reply posted successfully",
        processed: processed,
        stored_as_candidate: storedAsCandidate,
        storage_reason: storageReason,
      };

      appLogger.info(
        {
          result,
          execution_time_ms: executionTime,
        },
        "reply_mention: Operation completed successfully"
      );

      logger(
        `Posted reply to mention ${args.mention_id} successfully${
          processed ? " and marked as processed" : ""
        }${storedAsCandidate ? " (referenced tweets already stored)" : ""}`
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
          mention_id: args.mention_id,
          execution_time_ms: executionTime,
        },
        "reply_mention: Unexpected error occurred"
      );

      logger(`Failed to reply to mention: ${error.message}`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Unexpected error: ${error.message}`
      );
    }
  },
});

export default replyMentionFunction;
