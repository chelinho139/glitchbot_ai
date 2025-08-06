// Level 3: GameFunction - Reply to Tweet
import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import { createRateLimitedTwitterClient } from "../../../lib/rate-limited-twitter-client";
import appLogger from "../../../lib/log";

export interface ReplyResult {
  success: boolean;
  tweet_id?: string;
  reply_id?: string;
  message?: string;
}

export const replyToTweetFunction = new GameFunction({
  name: "reply_to_tweet",
  description:
    "Reply to a specific tweet with rate limit compliance and error handling",
  args: [
    { name: "tweet_id", description: "ID of tweet to reply to" },
    { name: "reply_text", description: "The reply content (max 280 chars)" },
  ] as const,
  executable: async (args, logger) => {
    const startTime = Date.now();

    try {
      logger("Starting reply to tweet");
      appLogger.info(
        {
          tweet_id: args.tweet_id,
          reply_length: args.reply_text?.length || 0,
        },
        "reply_to_tweet: Starting operation"
      );

      // Validate inputs
      if (!args.tweet_id || !args.reply_text) {
        appLogger.error("reply_to_tweet: Missing required parameters");
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "tweet_id and reply_text are required"
        );
      }

      if (args.reply_text.length > 280) {
        appLogger.error(
          { text_length: args.reply_text.length },
          "reply_to_tweet: Reply text exceeds Twitter limit"
        );
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          `Reply text too long: ${args.reply_text.length}/280 characters`
        );
      }

      // Initialize Twitter client
      const gameToken = process.env.GAME_TWITTER_TOKEN;
      if (!gameToken) {
        appLogger.error("reply_to_tweet: GAME_TWITTER_TOKEN not found");
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

      // Post the reply
      let apiResponse;
      try {
        apiResponse = await twitterClient.v2.reply(
          args.reply_text,
          args.tweet_id
        );

        appLogger.info(
          {
            original_tweet_id: args.tweet_id,
            reply_id: apiResponse.data.id,
            reply_text: args.reply_text,
          },
          "reply_to_tweet: Reply posted successfully"
        );
      } catch (apiError: any) {
        // Handle Twitter API errors
        if (apiError.code === 429) {
          appLogger.warn(
            {
              error: apiError.message,
              tweet_id: args.tweet_id,
            },
            "reply_to_tweet: Rate limit exceeded"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            "Rate limit exceeded for replies"
          );
        } else if (apiError.code >= 500) {
          appLogger.error(
            { error: apiError.message, code: apiError.code },
            "reply_to_tweet: Twitter API server error"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Twitter server error: ${apiError.message}`
          );
        } else if (apiError.code === 401) {
          appLogger.error(
            { error: apiError.message },
            "reply_to_tweet: Authentication failed"
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
            "reply_to_tweet: Twitter API error with detailed response"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Twitter API error: ${apiError.message}${
              apiError.detail ? ` - ${apiError.detail}` : ""
            }`
          );
        }
      }

      const executionTime = Date.now() - startTime;
      const result: ReplyResult = {
        success: true,
        tweet_id: args.tweet_id,
        reply_id: apiResponse.data.id,
        message: "Reply posted successfully",
      };

      appLogger.info(
        {
          result,
          execution_time_ms: executionTime,
        },
        "reply_to_tweet: Operation completed successfully"
      );

      logger(`Posted reply to tweet ${args.tweet_id} successfully`);

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
          tweet_id: args.tweet_id,
          execution_time_ms: executionTime,
        },
        "reply_to_tweet: Unexpected error occurred"
      );

      logger(`Failed to reply to tweet: ${error.message}`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Unexpected error: ${error.message}`
      );
    }
  },
});

export default replyToTweetFunction;
