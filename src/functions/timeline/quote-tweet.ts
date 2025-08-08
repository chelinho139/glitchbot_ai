import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import { createRateLimitedTwitterClient } from "../../lib/rate-limited-twitter-client";
import GlitchBotDB from "../../lib/db";
import appLogger from "../../lib/log";
import { checkAllGuards, updateQuoteTimestamp } from "../../lib/cadence";

/**
 * Quote-tweet function with engagement tracking.
 * Takes a tweet_id and a comment, checks for duplicates, and posts a real quote tweet via Twitter API.
 * Records engagement in engaged_quotes table to prevent duplicate quotes.
 */
const quoteTweetFunction = new GameFunction({
  name: "quote_tweet",
  description:
    "Quote-tweets a tweet with a comment using the Twitter API. Arguments must reference the SAME tweet: tweet_id must be the selected tweet, username must be the EXACT author username (without @) of that tweet. Calls may be rejected if arguments don't match. Includes duplicate prevention and rate limiting. Content selection is handled at the agent/worker level.",
  args: [
    {
      name: "tweet_id",
      description: "The ID of the tweet to quote (required)",
    },
    {
      name: "username",
      description:
        "EXACT username of the tweet's author (without @). Must match the author of tweet_id.",
    },
    {
      name: "comment",
      description:
        "Your commentary to add to the quote tweet (<= 280 chars including URL)",
    },
  ] as const,
  executable: async (args, logger) => {
    try {
      const { tweet_id, username, comment } = args;

      if (!tweet_id || !username || !comment) {
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "tweet_id, username, and comment are required"
        );
      }

      // Create the tweet URL for quoting
      const tweetUrl = `https://x.com/${username}/status/${tweet_id}`;
      const fullTweetText = `${comment} ${tweetUrl}`;

      // Validate total tweet length (Twitter limit is 280 characters)
      if (fullTweetText.length > 280) {
        appLogger.error(
          {
            comment_length: comment.length,
            url_length: tweetUrl.length,
            total_length: fullTweetText.length,
          },
          "quote_tweet: Tweet with URL exceeds Twitter character limit"
        );
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          `Tweet too long: ${fullTweetText.length}/280 characters (comment: ${comment.length}, URL: ${tweetUrl.length})`
        );
      }

      // Check if tweet was already quoted to avoid duplicates
      const db = new GlitchBotDB();
      if (db.isTweetQuoted(tweet_id)) {
        appLogger.warn(
          { tweet_id },
          "quote_tweet: Tweet already quoted, skipping duplicate"
        );
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          `Tweet ${tweet_id} was already quoted. Avoiding duplicate.`
        );
      }

      // Check cadence guards before posting
      if (!checkAllGuards(db, "quote")) {
        appLogger.info(
          { tweet_id },
          "quote_tweet: Quote cadence not met, skipping"
        );
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "Quote cadence not met; skipping"
        );
      }

      // Initialize Twitter client
      const gameToken = process.env.GAME_TWITTER_TOKEN;
      if (!gameToken) {
        appLogger.error("quote_tweet: GAME_TWITTER_TOKEN not found");
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "GAME_TWITTER_TOKEN is required. Set it in your .env file."
        );
      }

      const twitterClient = createRateLimitedTwitterClient({
        gameTwitterAccessToken: gameToken,
        workerId: "timeline-worker",
        defaultPriority: "medium",
      });

      // Content selection is enforced at the agent/worker level; no topic guard here

      // Post the quote tweet using Twitter API (with URL in text)
      let apiResponse;
      try {
        apiResponse = await twitterClient.v2.tweet(fullTweetText);

        appLogger.info(
          {
            original_tweet_id: tweet_id,
            original_username: username,
            quote_tweet_id: apiResponse.data.id,
            comment: comment,
            tweet_url: tweetUrl,
            full_tweet_text: fullTweetText,
            total_length: fullTweetText.length,
          },
          "quote_tweet: Quote tweet posted successfully via Twitter API"
        );
      } catch (apiError: any) {
        // Handle Twitter API errors
        if (apiError.code === 429) {
          appLogger.warn(
            {
              error: apiError.message,
              tweet_id: tweet_id,
              reset_time: apiError.rateLimit?.reset
                ? new Date(apiError.rateLimit.reset * 1000).toISOString()
                : "unknown",
            },
            "quote_tweet: Twitter API rate limit exceeded"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Rate limit exceeded. Reset at: ${
              apiError.rateLimit?.reset
                ? new Date(apiError.rateLimit.reset * 1000).toISOString()
                : "unknown"
            }`
          );
        } else if (apiError.code >= 500) {
          appLogger.error(
            { error: apiError.message, code: apiError.code },
            "quote_tweet: Twitter API server error"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Twitter API server error: ${apiError.message}`
          );
        } else if (apiError.code === 401) {
          appLogger.error(
            { error: apiError.message },
            "quote_tweet: Twitter API authentication failed"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Authentication failed: ${apiError.message}. Check your Twitter API credentials.`
          );
        } else {
          appLogger.error(
            {
              error: apiError.message,
              code: apiError.code,
              data: apiError.data || null,
              errors: apiError.errors || null,
              detail: apiError.detail || null,
              title: apiError.title || null,
              type: apiError.type || null,
            },
            "quote_tweet: Twitter API error with detailed response"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Twitter API error: ${apiError.message}${
              apiError.detail ? ` - ${apiError.detail}` : ""
            }`
          );
        }
      }

      // Record the engagement to prevent future duplicates
      db.recordQuoteEngagement(tweet_id);

      // Update quote timestamp for cadence tracking
      updateQuoteTimestamp(db);

      appLogger.info(
        {
          tweet_id,
          username,
          quote_tweet_id: apiResponse.data.id,
          tweet_url: tweetUrl,
          total_length: fullTweetText.length,
        },
        "quote_tweet: Successfully quote-tweeted and recorded engagement"
      );

      logger(
        `Quote-tweeted: ${tweet_id} (${username}) -> ${apiResponse.data.id} | ${comment}`
      );

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        `Successfully quote-tweeted @${username}'s tweet ${tweet_id} with comment: "${comment}". New tweet ID: ${apiResponse.data.id}`
      );
    } catch (error: any) {
      appLogger.error(
        { error: error.message, tweet_id: args.tweet_id },
        "quote_tweet: Error occurred during quote-tweet operation"
      );

      logger(`Failed to quote-tweet (dummy): ${error.message}`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Failed to quote-tweet (dummy): ${error.message}`
      );
    }
  },
});

export default quoteTweetFunction;
