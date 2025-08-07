// Level 3: GameFunction - Get Timeline
//
// Fetches home timeline (recommended tweets) from Twitter API v2
// This provides content for the bot to analyze and potentially quote tweet
//
// IMPORTANT: Uses v2.homeTimeline() for recommended feed content, not userTimeline()
// Reference: https://github.com/game-by-virtuals/game-twitter-node/blob/main/doc/v2.md#home-timeline

import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import appLogger from "../../lib/log";
import { createRateLimitedTwitterClient } from "../../lib/rate-limited-twitter-client";

// Define the structure for timeline tweet data
export interface TimelineTweet {
  id: string;
  text: string;
  author_id: string;
  author?:
    | {
        id: string;
        username: string;
        name?: string;
        description?: string;
        verified?: boolean;
        public_metrics?: {
          followers_count: number;
          following_count: number;
          tweet_count: number;
          listed_count: number;
        };
      }
    | undefined;
  created_at: string;
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
  context_annotations?: Array<{
    domain: {
      id: string;
      name: string;
      description?: string;
    };
    entity: {
      id: string;
      name: string;
      description?: string;
    };
  }>;
}

export interface GetTimelineResult {
  tweets: TimelineTweet[];
  meta: {
    result_count: number;
    newest_id?: string;
    oldest_id?: string;
    next_token?: string;
  };
  rate_limit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
}

export const getTimelineFunction = new GameFunction({
  name: "get_timeline",
  description:
    "Fetch home timeline (recommended tweets) for content discovery and curation. Returns tweets from the user's home feed - content from followed accounts and recommendations. This provides content that the bot can analyze and potentially quote tweet.",
  args: [],
  executable: async (_args, logger) => {
    const startTime = Date.now();

    // Set constants for timeline fetch
    const MAX_RESULTS = 10;
    const EXCLUDE = "replies";
    const PAGINATION_TOKEN = undefined;

    try {
      logger("Starting home timeline fetch operation");
      appLogger.info(
        {
          max_results: MAX_RESULTS,
          exclude: EXCLUDE,
          has_pagination_token: !!PAGINATION_TOKEN,
        },
        "get_timeline: Starting home timeline operation"
      );

      // Initialize Twitter client with GAME credentials
      const gameToken = process.env.GAME_TWITTER_TOKEN;
      if (!gameToken) {
        appLogger.error(
          "get_timeline: GAME_TWITTER_TOKEN not found in environment variables"
        );
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
      appLogger.debug(
        "get_timeline: Twitter client created successfully with GAME token"
      );

      // Make the API call to fetch home timeline (recommended feed)
      let apiResponse;
      try {
        const timelineParams: any = {
          max_results: MAX_RESULTS,
          expansions: [
            "author_id",
            "referenced_tweets.id",
            "referenced_tweets.id.author_id",
          ],
          "tweet.fields": [
            "created_at",
            "public_metrics",
            "referenced_tweets",
            "text",
            "context_annotations",
          ],
          "user.fields": [
            "id",
            "username",
            "name",
            "description",
            "verified",
            "public_metrics",
          ],
        };
        if (EXCLUDE) {
          timelineParams.exclude = EXCLUDE;
        }
        if (PAGINATION_TOKEN) {
          timelineParams.pagination_token = PAGINATION_TOKEN;
        }

        // Use the home timeline endpoint for recommended tweets
        // This endpoint returns tweets from the user's home feed (followed accounts + recommendations)
        // Reference: https://github.com/game-by-virtuals/game-twitter-node/blob/main/doc/v2.md#home-timeline
        apiResponse = await twitterClient.v2.homeTimeline(timelineParams);

        appLogger.info(
          {
            result_count: apiResponse.data.meta?.result_count || 0,
            newest_id: apiResponse.data.meta?.newest_id,
            oldest_id: apiResponse.data.meta?.oldest_id,
            rate_limit_remaining: apiResponse.rateLimit?.remaining,
          },
          "get_timeline: Home timeline API call completed successfully"
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
            "get_timeline: Twitter API rate limit exceeded"
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
            "get_timeline: Twitter API server error"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Twitter API server error: ${apiError.message}`
          );
        } else if (apiError.code === 401) {
          appLogger.error(
            { error: apiError.message },
            "get_timeline: Twitter API authentication failed"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Authentication failed: ${apiError.message}. Check your Twitter API credentials.`
          );
        } else {
          appLogger.error(
            { error: apiError.message, code: apiError.code },
            "get_timeline: Twitter API error"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Twitter API error: ${apiError.message}`
          );
        }
      }

      // Process timeline response
      const tweets: TimelineTweet[] = [];

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
              "get_timeline: Skipping tweet with missing required fields"
            );
            continue;
          }

          // Find author info if available in includes
          let authorInfo: TimelineTweet["author"] = undefined;
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
              if (authorData.verified !== undefined)
                authorInfo.verified = authorData.verified;

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

          const timelineTweet: TimelineTweet = {
            id: tweet.id,
            text: tweet.text,
            author_id: tweet.author_id,
            author: authorInfo,
            created_at: tweet.created_at,
          };

          // Add optional fields only if they exist
          if (tweet.public_metrics) {
            timelineTweet.public_metrics = {
              retweet_count: tweet.public_metrics.retweet_count || 0,
              like_count: tweet.public_metrics.like_count || 0,
              reply_count: tweet.public_metrics.reply_count || 0,
              quote_count: tweet.public_metrics.quote_count || 0,
              bookmark_count: tweet.public_metrics.bookmark_count || 0,
              impression_count: tweet.public_metrics.impression_count || 0,
            };
          }

          if (tweet.referenced_tweets) {
            timelineTweet.referenced_tweets = tweet.referenced_tweets;
          }

          if (tweet.context_annotations) {
            timelineTweet.context_annotations = tweet.context_annotations;
          }

          tweets.push(timelineTweet);
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

      const meta = {
        result_count: apiResponse.data.meta?.result_count || tweets.length,
        newest_id: apiResponse.data.meta?.newest_id,
        oldest_id: apiResponse.data.meta?.oldest_id,
        next_token: apiResponse.data.meta?.next_token,
      };

      const result: GetTimelineResult = {
        tweets,
        meta,
      };

      if (rateLimitInfo) {
        result.rate_limit = rateLimitInfo;
      }

      appLogger.info(
        {
          tweets_count: tweets.length,
          execution_time_ms: startTime,
          rate_limit_remaining: result.rate_limit?.remaining,
          newest_id: result.meta.newest_id,
          exclude_filter: EXCLUDE || "none",
        },
        "get_timeline: Home timeline operation completed successfully"
      );

      logger(`Fetched ${tweets.length} home timeline tweets in ${startTime}ms`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify(result)
      );
    } catch (error: any) {
      appLogger.error(
        { error: error.message, code: error.code },
        "get_timeline: Home timeline operation failed"
      );
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Failed to fetch home timeline: ${error.message}`
      );
    }
  },
});

export default getTimelineFunction;
