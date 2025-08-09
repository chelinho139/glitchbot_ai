// Level 3: GameFunction - Get Timeline With Suggestion Mix
//
// Fetches home timeline (recommended tweets) from Twitter API v2 and mixes in
// a small number of community-suggested tweets discovered via mentions within
// the last 10 hours. Suggestions are normalized to the same TimelineTweet
// shape used by get_timeline so downstream selection/quoting is unchanged.

import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import appLogger from "../../lib/log";
import { createRateLimitedTwitterClient } from "../../lib/rate-limited-twitter-client";
import GlitchBotDB from "../../lib/db";
import type { TimelineTweet, GetTimelineResult } from "./get-timeline";
import { fetchRecentSuggestedAsTimelineTweets } from "../../lib/suggestions";

export const getTimelineWithSuggestionFunction = new GameFunction({
  name: "get_timeline_with_suggestion",
  description:
    "Fetch home timeline (recommended tweets) and mix in up to 2 suggested tweets discovered via mentions within the last 10 hours. Returns a unified list of TimelineTweet objects.",
  args: [],
  executable: async (_args, logger) => {
    const startTime = Date.now();

    // Constants
    const TIMELINE_MAX_RESULTS = 10;
    const EXCLUDE = "replies";
    const SUGGESTION_MIX_LIMIT = 2;
    const SUGGESTION_WINDOW_HOURS = 10;

    try {
      logger("Starting home timeline + suggestions fetch operation");

      // Initialize DB
      const db = new GlitchBotDB();

      // Initialize Twitter client with GAME credentials
      const gameToken = process.env.GAME_TWITTER_TOKEN;
      if (!gameToken) {
        appLogger.error(
          "get_timeline_with_suggestion: GAME_TWITTER_TOKEN not found in environment variables"
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

      // 1) Fetch home timeline from Twitter API
      let apiResponse: any;
      const timelineTweets: TimelineTweet[] = [];
      try {
        const timelineParams: any = {
          max_results: TIMELINE_MAX_RESULTS,
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

        apiResponse = await twitterClient.v2.homeTimeline(timelineParams);

        appLogger.info(
          {
            result_count: apiResponse.data.meta?.result_count || 0,
            newest_id: apiResponse.data.meta?.newest_id,
            oldest_id: apiResponse.data.meta?.oldest_id,
            rate_limit_remaining: apiResponse.rateLimit?.remaining,
          },
          "get_timeline_with_suggestion: Home timeline API call completed"
        );

        // Build TimelineTweet[] from API
        if (
          apiResponse.data &&
          apiResponse.data.data &&
          Array.isArray(apiResponse.data.data)
        ) {
          for (const tweet of apiResponse.data.data) {
            if (
              !tweet.id ||
              !tweet.text ||
              !tweet.author_id ||
              !tweet.created_at
            ) {
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
                if (authorData.name) authorInfo.name = authorData.name;
                if (authorData.description)
                  authorInfo.description = authorData.description;
                if (authorData.verified !== undefined)
                  authorInfo.verified = authorData.verified;
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

            const t: TimelineTweet = {
              id: tweet.id,
              text: tweet.text,
              author_id: tweet.author_id,
              author: authorInfo,
              created_at: tweet.created_at,
            };

            if (tweet.public_metrics) {
              t.public_metrics = {
                retweet_count: tweet.public_metrics.retweet_count || 0,
                like_count: tweet.public_metrics.like_count || 0,
                reply_count: tweet.public_metrics.reply_count || 0,
                quote_count: tweet.public_metrics.quote_count || 0,
                bookmark_count: tweet.public_metrics.bookmark_count || 0,
                impression_count: tweet.public_metrics.impression_count || 0,
              };
            }
            if (tweet.referenced_tweets) {
              t.referenced_tweets = tweet.referenced_tweets;
            }
            if (tweet.context_annotations) {
              t.context_annotations = tweet.context_annotations;
            }

            timelineTweets.push(t);
          }
        }
      } catch (apiError: any) {
        if (apiError.code === 429) {
          appLogger.warn(
            {
              error: apiError.message,
              reset_time: apiError.rateLimit?.reset
                ? new Date(apiError.rateLimit.reset * 1000).toISOString()
                : "unknown",
            },
            "get_timeline_with_suggestion: Twitter API rate limit exceeded"
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
            "get_timeline_with_suggestion: Twitter API server error"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Twitter API server error: ${apiError.message}`
          );
        } else if (apiError.code === 401) {
          appLogger.error(
            { error: apiError.message },
            "get_timeline_with_suggestion: Twitter API authentication failed"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Authentication failed: ${apiError.message}. Check your Twitter API credentials.`
          );
        } else {
          appLogger.error(
            { error: apiError.message, code: apiError.code },
            "get_timeline_with_suggestion: Twitter API error"
          );
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Twitter API error: ${apiError.message}`
          );
        }
      }

      // 2) Load recent suggestions from DB via helper (<= 10 hours)
      const selfUsernameRaw =
        process.env.BOT_TWITTER_USERNAME || process.env.SELF_TWITTER_USERNAME;
      const selfUsername = selfUsernameRaw
        ? selfUsernameRaw.replace(/^@/, "").toLowerCase()
        : undefined;

      const suggestionOptions = selfUsername
        ? {
            windowHours: SUGGESTION_WINDOW_HOURS,
            limit: SUGGESTION_MIX_LIMIT,
            selfUsername,
          }
        : { windowHours: SUGGESTION_WINDOW_HOURS, limit: SUGGESTION_MIX_LIMIT };

      const suggestionTweets = fetchRecentSuggestedAsTimelineTweets(
        db,
        suggestionOptions as any
      ) as TimelineTweet[];

      // 3) Merge and dedupe by tweet id
      const seenIds = new Set<string>();
      const merged: TimelineTweet[] = [];

      for (const t of timelineTweets) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          merged.push(t);
        }
      }
      for (const t of suggestionTweets) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          merged.push(t);
        }
      }

      const filteredMerged = selfUsername
        ? merged.filter(
            (t) => (t.author?.username || "").toLowerCase() !== selfUsername
          )
        : merged;

      // Sort by created_at desc to mix suggestions naturally with timeline
      filteredMerged.sort((a, b) => {
        const at = new Date(a.created_at).getTime();
        const bt = new Date(b.created_at).getTime();
        return bt - at;
      });

      // Cap total results
      const FINAL_CAP = TIMELINE_MAX_RESULTS + SUGGESTION_MIX_LIMIT;
      const finalTweets = filteredMerged.slice(0, FINAL_CAP);

      // Build meta from API and adjust result_count
      const rateLimitInfo = apiResponse.rateLimit
        ? {
            limit: apiResponse.rateLimit.limit,
            remaining: apiResponse.rateLimit.remaining,
            reset: apiResponse.rateLimit.reset,
          }
        : undefined;

      const meta = {
        result_count: finalTweets.length,
        newest_id: apiResponse.data.meta?.newest_id,
        oldest_id: apiResponse.data.meta?.oldest_id,
        next_token: apiResponse.data.meta?.next_token,
      };

      const result: GetTimelineResult = {
        tweets: finalTweets,
        meta,
      };
      if (rateLimitInfo) {
        result.rate_limit = rateLimitInfo;
      }

      const executionTime = Date.now() - startTime;
      appLogger.info(
        {
          tweets_count: finalTweets.length,
          suggestions_considered: suggestionTweets.length,
          execution_time_ms: executionTime,
          rate_limit_remaining: result.rate_limit?.remaining,
          next_token: result.meta.next_token ? "present" : "none",
        },
        "get_timeline_with_suggestion: Operation completed successfully"
      );

      logger(
        `Fetched ${finalTweets.length} mixed timeline tweets (incl. suggestions) in ${executionTime}ms`
      );

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify(result)
      );
    } catch (error: any) {
      appLogger.error(
        { error: error.message, code: error.code },
        "get_timeline_with_suggestion: Operation failed"
      );
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Failed to fetch mixed timeline: ${error.message}`
      );
    }
  },
});

export default getTimelineWithSuggestionFunction;
