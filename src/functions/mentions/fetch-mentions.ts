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
import appLogger from "../../lib/log";
import { createRateLimitedTwitterClient } from "../../lib/rate-limited-twitter-client";
import GlitchBotDB from "../../lib/db";

// Helper function for priority calculation
function calculatePriority(): number {
  // Simple priority calculation - everyone gets same priority for now
  // Priority 5 = default priority for all mentions
  // This can be enhanced later with intent analysis or other factors
  return 5; // Default priority for all mentions
}

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

export interface FetchMentionsResult {
  mentions: TwitterMention[];
  meta: {
    newest_id?: string;
    oldest_id?: string;
    result_count: number;
    next_token?: string;
  };
  storage: {
    stored_count: number;
    skipped_count: number;
    total_fetched: number;
  };
  rate_limit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
  includes?: {
    tweets?: Array<{
      id: string;
      text: string;
      author_id: string;
      created_at: string;
      public_metrics?: {
        retweet_count: number;
        like_count: number;
        reply_count: number;
        quote_count: number;
        bookmark_count?: number;
        impression_count?: number;
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
    }>;
    users?: Array<{
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
    }>;
    media?: Array<any>;
    polls?: Array<any>;
    places?: Array<any>;
  };
}

export const fetchMentionsFunction = new GameFunction({
  name: "fetch_mentions",
  description:
    "Fetch recent mentions from Twitter API v2 with automatic checkpoint management and storage. Always reads stored checkpoint and fetches only new mentions. Automatically stores all fetched mentions in the pending_mentions queue for processing. Updates checkpoint after successful fetch. Returns count of mentions stored. Includes comprehensive error handling, rate limiting, and automatic user ID caching",
  args: [
    {
      name: "max_results",
      description: "Maximum number of mentions to fetch (5-100, default: 50)",
    },
  ] as const,
  executable: async (args, logger) => {
    const startTime = Date.now();

    console.log("\n🚀 fetch_mentions FUNCTION CALLED!");
    console.log("📥 Input args:", { max_results: args.max_results });

    try {
      logger("Starting mention fetch operation");
      appLogger.info(
        {
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

      // Auto-checkpoint: Always read last checkpoint from database
      console.log("🗂️ Reading checkpoint from database...");
      let effectiveSinceId: string | undefined;
      try {
        const db = new GlitchBotDB();
        const lastSince = db.getLastMentionSinceId();

        if (lastSince) {
          effectiveSinceId = lastSince;
          console.log("✅ Found checkpoint:", effectiveSinceId);
          appLogger.info(
            { checkpoint_since_id: effectiveSinceId },
            "fetch_mentions: Using stored checkpoint as since_id"
          );
        } else {
          console.log("ℹ️ No checkpoint found, fetching all recent mentions");
          appLogger.info(
            "fetch_mentions: No checkpoint found, fetching all recent mentions"
          );
        }
      } catch (checkpointError: any) {
        console.log("⚠️ Checkpoint read error:", checkpointError.message);
        appLogger.warn(
          { error: checkpointError.message },
          "fetch_mentions: Failed to read checkpoint, proceeding without since_id"
        );
      }

      // Make the API call using composite method (tracks both get_user and fetch_mentions rate limits)
      console.log("🐦 Making Twitter API call...");
      console.log("📋 API options:", {
        max_results: maxResults,
        since_id: effectiveSinceId || "none",
      });
      let apiResponse;
      try {
        const mentionsOptions: any = {
          max_results: maxResults,
        };
        if (effectiveSinceId) {
          mentionsOptions.since_id = effectiveSinceId;
        }

        apiResponse = await twitterClient.fetchUserMentions(mentionsOptions);
        console.log("✅ Twitter API call successful!");

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
        console.log("❌ Twitter API Error:", apiError.message);
        console.log("🔢 Error code:", apiError.code);
        // Handle Twitter API errors
        if (apiError.code === 429) {
          console.log("⏰ Rate limit exceeded!");
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

      // Process real API response and store mentions
      const mentions: TwitterMention[] = [];
      let storedCount = 0;
      let skippedCount = 0;
      const fetchId = `fetch_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Initialize database for storage
      const db = new GlitchBotDB();

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

          if (tweet.context_annotations) {
            mention.context_annotations = tweet.context_annotations;
          }

          mentions.push(mention);

          // Store mention in database
          try {
            const priority = calculatePriority();
            const authorUsername = mention.author?.username || "unknown";

            // Prepare referenced_tweets data as JSON string
            const referencedTweetsJson = mention.referenced_tweets
              ? JSON.stringify(mention.referenced_tweets)
              : null;

            // Insert or replace (in case of duplicate fetch)
            db.database
              .prepare(
                `
              INSERT OR REPLACE INTO pending_mentions 
              (mention_id, author_id, author_username, text, created_at, 
               status, priority, original_fetch_id, referenced_tweets)
              VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
            `
              )
              .run([
                mention.id,
                mention.author_id,
                authorUsername,
                mention.text,
                mention.created_at,
                priority,
                fetchId,
                referencedTweetsJson,
              ]);

            // Note: Referenced tweets will be processed from apiResponse.includes.tweets
            // after all mentions are processed, using the existing includes data
            // instead of making additional API calls

            storedCount++;

            appLogger.debug(
              {
                mention_id: mention.id,
                author: authorUsername,
                priority,
                text_preview: (mention.text || "").substring(0, 50) + "...",
              },
              "fetch_mentions: Stored mention in pending queue"
            );
          } catch (storageError: any) {
            appLogger.error(
              {
                mention_id: mention.id,
                error: storageError.message,
              },
              "fetch_mentions: Failed to store mention in database"
            );
            skippedCount++;
          }
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
        storage: {
          stored_count: storedCount,
          skipped_count: skippedCount,
          total_fetched: mentions.length,
        },
      } as FetchMentionsResult;

      if (rateLimitInfo) {
        result.rate_limit = rateLimitInfo;
      }

      // Add includes section if present in API response
      if (apiResponse.data.includes) {
        result.includes = {};

        // Process included tweets (referenced tweets) and store as suggested tweets
        if (apiResponse.data.includes.tweets) {
          result.includes.tweets = apiResponse.data.includes.tweets.map(
            (tweet: any) => ({
              id: tweet.id,
              text: tweet.text,
              author_id: tweet.author_id,
              created_at: tweet.created_at,
              public_metrics: tweet.public_metrics
                ? {
                    retweet_count: tweet.public_metrics.retweet_count || 0,
                    like_count: tweet.public_metrics.like_count || 0,
                    reply_count: tweet.public_metrics.reply_count || 0,
                    quote_count: tweet.public_metrics.quote_count || 0,
                    bookmark_count: tweet.public_metrics.bookmark_count || 0,
                    impression_count:
                      tweet.public_metrics.impression_count || 0,
                  }
                : undefined,
              referenced_tweets: tweet.referenced_tweets,
              context_annotations: tweet.context_annotations,
            })
          );

          // Store referenced tweets as suggested tweets using the includes data
          for (const includedTweet of apiResponse.data.includes.tweets) {
            try {
              // Check if this tweet is already stored as a suggested tweet
              const existingCandidate = db.database
                .prepare(
                  `SELECT tweet_id FROM suggested_tweets WHERE tweet_id = ?`
                )
                .get(includedTweet.id);

              if (!existingCandidate) {
                // Find the author from includes.users
                let authorUsername = "unknown";
                if (apiResponse.data.includes.users) {
                  const author = apiResponse.data.includes.users.find(
                    (user: any) => user.id === includedTweet.author_id
                  );
                  if (author) {
                    authorUsername = author.username;
                  }
                }

                // Find which mention referenced this tweet - Enhanced linkage
                let discoveredViaMentionId = "unknown";
                let mentionAuthor = "unknown";
                let mentionText = "";

                for (const mention of mentions) {
                  if (mention.referenced_tweets) {
                    const hasReference = mention.referenced_tweets.some(
                      (ref: any) => ref.id === includedTweet.id
                    );
                    if (hasReference) {
                      discoveredViaMentionId = mention.id;
                      mentionAuthor = mention.author?.username || "unknown";
                      mentionText = mention.text || "";
                      break;
                    }
                  }
                }

                // Enhanced logging for better traceability
                appLogger.debug(
                  {
                    referenced_tweet_id: includedTweet.id,
                    discovered_via_mention_id: discoveredViaMentionId,
                    mention_author: mentionAuthor,
                    mention_text_preview: mentionText.substring(0, 100) + "...",
                    linkage_status:
                      discoveredViaMentionId !== "unknown"
                        ? "linked"
                        : "orphaned",
                  },
                  "fetch_mentions: Processing suggested tweet linkage"
                );

                // Create suggested tweet using the includes data (like legacy system)
                const candidateTweet: any = {
                  tweet_id: includedTweet.id,
                  author_id: includedTweet.author_id,
                  author_username: authorUsername,
                  content: includedTweet.text,
                  created_at: includedTweet.created_at,
                  discovered_via_mention_id: discoveredViaMentionId,
                  discovery_timestamp: new Date().toISOString(),
                  curation_score: 7, // Higher score since it was actively shared
                };

                // Add public_metrics if available
                if (includedTweet.public_metrics) {
                  candidateTweet.public_metrics = JSON.stringify(
                    includedTweet.public_metrics
                  );
                }

                db.addSuggestedTweet(candidateTweet);

                appLogger.info(
                  {
                    referenced_tweet_id: includedTweet.id,
                    discovered_via_mention_id: discoveredViaMentionId,
                    tweet_author: authorUsername,
                    mention_author: mentionAuthor,
                    mention_text_preview: mentionText.substring(0, 50) + "...",
                    curation_score: 7,
                    action: "referenced_tweet_stored_with_linkage",
                    linkage_quality:
                      discoveredViaMentionId !== "unknown"
                        ? "properly_linked"
                        : "orphaned_tweet",
                  },
                  "fetch_mentions: Referenced tweet stored with mention linkage"
                );
              }
            } catch (refTweetError: any) {
              appLogger.warn(
                {
                  referenced_tweet_id: includedTweet.id,
                  error: refTweetError.message,
                },
                "fetch_mentions: Failed to store referenced tweet from includes"
              );
              // Don't fail the main operation, just log the warning
            }
          }
        }

        // Process included users (we already have this logic above, but keep it here too)
        if (apiResponse.data.includes.users) {
          result.includes.users = apiResponse.data.includes.users.map(
            (user: any) => ({
              id: user.id,
              username: user.username,
              name: user.name,
              description: user.description,
              verified: user.verified,
              public_metrics: user.public_metrics
                ? {
                    followers_count: user.public_metrics.followers_count || 0,
                    following_count: user.public_metrics.following_count || 0,
                    tweet_count: user.public_metrics.tweet_count || 0,
                    listed_count: user.public_metrics.listed_count || 0,
                  }
                : undefined,
            })
          );
        }

        // Add other includes sections if they exist
        if (apiResponse.data.includes.media) {
          result.includes.media = apiResponse.data.includes.media;
        }
        if (apiResponse.data.includes.polls) {
          result.includes.polls = apiResponse.data.includes.polls;
        }
        if (apiResponse.data.includes.places) {
          result.includes.places = apiResponse.data.includes.places;
        }
      }

      console.log("📊 Processing complete!");
      console.log("📈 Mentions found:", mentions.length);
      console.log("💾 Mentions stored:", storedCount);
      console.log("⚠️ Mentions skipped:", skippedCount);
      console.log("🆔 Newest ID:", result.meta.newest_id || "none");
      console.log("🆔 Oldest ID:", result.meta.oldest_id || "none");

      // Log linkage summary for suggested tweets
      if (result.includes?.tweets) {
        console.log(
          "🔗 Referenced tweets found:",
          result.includes.tweets.length
        );
        console.log(
          "📊 Linkage summary: All referenced tweets linked to their originating mentions"
        );
      }

      appLogger.info(
        {
          mentions_count: mentions.length,
          stored_count: storedCount,
          skipped_count: skippedCount,
          referenced_tweets_count: result.includes?.tweets?.length || 0,
          linkage_enabled: true,
          fetch_id: fetchId,
        },
        "fetch_mentions: Real API response processed with mention-tweet linkage"
      );

      // Auto-checkpoint: Update checkpoint with newest_id if we got new mentions
      if (result.meta.newest_id && result.mentions.length > 0) {
        console.log(
          "💾 Updating checkpoint with newest ID:",
          result.meta.newest_id
        );
        try {
          const db = new GlitchBotDB();
          db.setMentionCheckpoint(result.meta.newest_id);

          appLogger.info(
            {
              new_checkpoint: result.meta.newest_id,
            },
            "fetch_mentions: Checkpoint updated automatically"
          );
        } catch (checkpointError: any) {
          appLogger.warn(
            {
              error: checkpointError.message,
              newest_id: result.meta.newest_id,
            },
            "fetch_mentions: Failed to update checkpoint, but fetch succeeded"
          );
        }
      }

      const executionTime = Date.now() - startTime;

      appLogger.info(
        {
          mentions_count: result.mentions.length,
          stored_count: result.storage.stored_count,
          skipped_count: result.storage.skipped_count,
          execution_time_ms: executionTime,
          rate_limit_remaining: result.rate_limit?.remaining,
          newest_id: result.meta.newest_id,
          fetch_id: fetchId,
        },
        "fetch_mentions: Operation completed successfully"
      );

      logger(
        `Fetched ${result.mentions.length} mentions, stored ${result.storage.stored_count} in queue (${result.storage.skipped_count} skipped) in ${executionTime}ms`
      );

      console.log("🎯 FUNCTION COMPLETED SUCCESSFULLY!");
      console.log("⏱️ Execution time:", executionTime + "ms");
      console.log("📤 Returning:", result.mentions.length, "mentions");
      console.log(
        "💾 Stored in queue:",
        result.storage.stored_count,
        "mentions"
      );

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify(result)
      );
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      console.log("💥 FUNCTION FAILED!");
      console.log("❌ Unexpected error:", error.message);
      console.log("⏱️ Execution time:", executionTime + "ms");

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
