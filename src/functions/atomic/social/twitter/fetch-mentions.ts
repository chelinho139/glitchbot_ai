// Level 3: GameFunction - Fetch Mentions
//
// Atomic function to fetch recent mentions from Twitter API v2
// This is the lowest level - just executes a specific action
//
// RATE LIMIT OPTIMIZATION: Uses centralized user ID caching via RateLimitedTwitterClient
// - Automatically handles caching and rate limiting for user ID retrieval
// - Tracks both get_user and fetch_mentions rate limit usage
// - No duplicate caching logic needed

import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import appLogger from "../../../../lib/log";
import { createRateLimitedTwitterClient } from "../../../../lib/rate-limited-twitter-client";

// Define the structure for Twitter user/author data
export interface TwitterAuthor {
  id: string;
  username: string;
  name?: string;
  description?: string; // bio
  location?: string;
  profile_image_url?: string;
  url?: string;
  verified?: boolean;
  verified_type?: string;
  protected?: boolean;
  created_at?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  pinned_tweet_id?: string;
}

// Define the structure for mention data
export interface TwitterMention {
  id: string;
  text: string;
  author_id: string;
  author: TwitterAuthor | undefined; // Complete author information
  created_at: string;
  edit_history_tweet_ids?: string[];
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
    bookmark_count: number;
    impression_count: number;
  };
  referenced_tweets?: Array<{
    type: string;
    id: string;
  }>;
}

export interface FetchMentionsResult {
  mentions: TwitterMention[];
  meta: {
    newest_id?: string;
    oldest_id?: string;
    result_count: number;
    next_token?: string;
  };
  rate_limit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
}

export const fetchMentionsFunction = new GameFunction({
  name: "fetch_mentions",
  description:
    "Fetch recent mentions from Twitter API v2 with comprehensive error handling, rate limiting, and automatic user ID caching",
  args: [
    {
      name: "since_id",
      description:
        "Only fetch tweets after this ID to avoid duplicates (optional)",
    },
    {
      name: "max_results",
      description: "Maximum number of mentions to fetch (5-100, default: 50)",
    },
  ] as const,
  executable: async (args, logger) => {
    const startTime = Date.now();

    try {
      logger("Starting mention fetch operation");
      appLogger.info(
        {
          since_id: args.since_id,
          max_results: args.max_results,
        },
        "fetch_mentions: Starting operation"
      );

      const maxResults = Math.min(
        Math.max(parseInt(args.max_results || "50"), 5),
        100
      );

      // Initialize Twitter client with GAME credentials
      const gameToken = process.env.GAME_TWITTER_TOKEN;
      if (!gameToken) {
        appLogger.error(
          "fetch_mentions: GAME_TWITTER_TOKEN not found in environment variables"
        );
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "GAME_TWITTER_TOKEN is required. Set it in your .env file."
        );
      }

      const twitterClient = createRateLimitedTwitterClient({
        gameTwitterAccessToken: gameToken,
        workerId: "mentions-worker",
        defaultPriority: "high",
      });
      appLogger.debug(
        "fetch_mentions: Twitter client created successfully with GAME token"
      );

      // Make the API call using composite method (tracks both get_user and fetch_mentions rate limits)
      let apiResponse;
      try {
        const mentionsOptions: any = {
          max_results: maxResults,
        };
        if (args.since_id) {
          mentionsOptions.since_id = args.since_id;
        }

        apiResponse = await twitterClient.fetchUserMentions(mentionsOptions);

        appLogger.info(
          {
            result_count: apiResponse.data.meta?.result_count || 0,
            newest_id: apiResponse.data.meta?.newest_id,
            oldest_id: apiResponse.data.meta?.oldest_id,
            rate_limit_remaining: apiResponse.rateLimit?.remaining,
          },
          "fetch_mentions: Composite API call completed successfully (dual rate limit tracking)"
        );
      } catch (apiError: any) {
        // Handle Twitter API errors
        if (apiError.code === 429) {
          appLogger.warn(
            {
              error: apiError.message,
              reset_time: apiError.rateLimit?.reset
                ? new Date(apiError.rateLimit.reset * 1000).toISOString()
                : "unknown",
            },
            "fetch_mentions: Twitter API rate limit exceeded"
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
            "fetch_mentions: Twitter API server error"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Twitter API server error: ${apiError.message}`
          );
        } else if (apiError.code === 401) {
          appLogger.error(
            { error: apiError.message },
            "fetch_mentions: Twitter API authentication failed"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Authentication failed: ${apiError.message}. Check your Twitter API credentials.`
          );
        } else {
          appLogger.error(
            { error: apiError.message, code: apiError.code },
            "fetch_mentions: Twitter API error"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Twitter API error: ${apiError.message}`
          );
        }
      }

      // Process real API response
      const mentions: TwitterMention[] = [];

      if (
        apiResponse.data &&
        apiResponse.data.data &&
        Array.isArray(apiResponse.data.data)
      ) {
        for (const tweet of apiResponse.data.data) {
          // Skip tweets without required fields
          if (
            !tweet.id ||
            !tweet.text ||
            !tweet.author_id ||
            !tweet.created_at
          ) {
            appLogger.warn(
              { tweet_id: tweet.id || "unknown" },
              "fetch_mentions: Skipping tweet with missing required fields"
            );
            continue;
          }

          // Find comprehensive author info if available in includes
          let authorInfo: TwitterAuthor | undefined = undefined;
          if (apiResponse.data.includes?.users) {
            const authorData = apiResponse.data.includes.users.find(
              (user: any) => user.id === tweet.author_id
            );

            if (authorData) {
              authorInfo = {
                id: authorData.id,
                username: authorData.username,
              };

              // Add optional fields only if they exist
              if (authorData.name) authorInfo.name = authorData.name;
              if (authorData.description)
                authorInfo.description = authorData.description;
              if (authorData.location)
                authorInfo.location = authorData.location;
              if (authorData.profile_image_url)
                authorInfo.profile_image_url = authorData.profile_image_url;
              if (authorData.url) authorInfo.url = authorData.url;
              if (authorData.verified !== undefined)
                authorInfo.verified = authorData.verified;
              if (authorData.verified_type)
                authorInfo.verified_type = authorData.verified_type;
              if (authorData.protected !== undefined)
                authorInfo.protected = authorData.protected;
              if (authorData.created_at)
                authorInfo.created_at = authorData.created_at;
              if (authorData.pinned_tweet_id)
                authorInfo.pinned_tweet_id = authorData.pinned_tweet_id;

              // Add author public metrics if available
              if (authorData.public_metrics) {
                authorInfo.public_metrics = {
                  followers_count:
                    authorData.public_metrics.followers_count || 0,
                  following_count:
                    authorData.public_metrics.following_count || 0,
                  tweet_count: authorData.public_metrics.tweet_count || 0,
                  listed_count: authorData.public_metrics.listed_count || 0,
                };
              }
            }
          }

          const mention: TwitterMention = {
            id: tweet.id,
            text: tweet.text,
            author_id: tweet.author_id,
            author: authorInfo,
            created_at: tweet.created_at,
          };

          // Add optional fields only if they exist
          if (tweet.edit_history_tweet_ids) {
            mention.edit_history_tweet_ids = tweet.edit_history_tweet_ids;
          }

          if (tweet.public_metrics) {
            mention.public_metrics = {
              retweet_count: tweet.public_metrics.retweet_count || 0,
              like_count: tweet.public_metrics.like_count || 0,
              reply_count: tweet.public_metrics.reply_count || 0,
              quote_count: tweet.public_metrics.quote_count || 0,
              bookmark_count: tweet.public_metrics.bookmark_count || 0,
              impression_count: tweet.public_metrics.impression_count || 0,
            };
          }

          if (tweet.referenced_tweets) {
            mention.referenced_tweets = tweet.referenced_tweets;
          }

          mentions.push(mention);
        }
      }

      // Extract rate limit information
      const rateLimitInfo = apiResponse.rateLimit
        ? {
            limit: apiResponse.rateLimit.limit,
            remaining: apiResponse.rateLimit.remaining,
            reset: apiResponse.rateLimit.reset,
          }
        : undefined;

      const meta: FetchMentionsResult["meta"] = {
        result_count: apiResponse.data.meta?.result_count || mentions.length,
      };

      // BUGFIX: Calculate newest/oldest from actual mention IDs, don't trust Twitter's meta
      // Twitter's meta.newest_id can return referenced tweet IDs instead of mention tweet IDs
      if (mentions.length > 0) {
        const mentionIds = mentions.map((m) => BigInt(m.id));
        meta.newest_id = mentionIds
          .reduce((max, id) => (id > max ? id : max))
          .toString();
        meta.oldest_id = mentionIds
          .reduce((min, id) => (id < min ? id : min))
          .toString();
      } else {
        // Fallback to API meta if no mentions processed
        if (apiResponse.data.meta?.newest_id)
          meta.newest_id = apiResponse.data.meta.newest_id;
        if (apiResponse.data.meta?.oldest_id)
          meta.oldest_id = apiResponse.data.meta.oldest_id;
      }
      if (apiResponse.data.meta?.next_token)
        meta.next_token = apiResponse.data.meta.next_token;

      const result = {
        mentions,
        meta,
      } as FetchMentionsResult;

      if (rateLimitInfo) {
        result.rate_limit = rateLimitInfo;
      }

      appLogger.info(
        { mentions_count: mentions.length },
        "fetch_mentions: Real API response processed successfully"
      );

      const executionTime = Date.now() - startTime;

      appLogger.info(
        {
          mentions_count: result.mentions.length,
          execution_time_ms: executionTime,
          rate_limit_remaining: result.rate_limit?.remaining,
          newest_id: result.meta.newest_id,
        },
        "fetch_mentions: Operation completed successfully"
      );

      logger(
        `Fetched ${result.mentions.length} mentions successfully in ${executionTime}ms`
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
        },
        "fetch_mentions: Unexpected error occurred"
      );

      logger(`Failed to fetch mentions: ${error.message}`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Unexpected error: ${error.message}`
      );
    }
  },
});

export default fetchMentionsFunction;
