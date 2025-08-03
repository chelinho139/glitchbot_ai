import { TwitterApi } from "@virtuals-protocol/game-twitter-node";
import { globalRateLimiter } from "../persistence/global/rate-limiter";
import appLogger from "./log";

// User cache for avoiding repeated .me() calls
interface UserCacheEntry {
  userId: string;
  username: string;
  gameToken: string;
  cachedAt: number;
}

interface CacheConfig {
  ttlHours?: number;
  maxEntries?: number;
}

// Global user cache (persists across client instances)
const userCache = new Map<string, UserCacheEntry>();
const DEFAULT_CACHE_TTL_HOURS = 2; // Reduced from 24 hours - more reasonable
const MAX_CACHE_ENTRIES = 100; // Prevent memory bloat

export interface RateLimitedClientConfig {
  gameTwitterAccessToken: string;
  workerId: string;
  defaultPriority?: "low" | "medium" | "high" | "critical";
  cache?: CacheConfig;
}

export class RateLimitedTwitterClient {
  private client: TwitterApi;
  private workerId: string;
  private defaultPriority: "low" | "medium" | "high" | "critical";
  private gameToken: string;
  private cacheConfig: CacheConfig;

  // Method to endpoint mapping for automatic detection
  private static readonly METHOD_ENDPOINTS = {
    // Timeline and mentions
    userMentionTimeline: "fetch_mentions",
    homeTimeline: "fetch_timeline",
    userTimeline: "fetch_timeline",

    // User information
    me: "get_user",
    user: "get_user",
    users: "get_user",

    // Posting and engagement
    tweet: "post_tweet",
    reply: "reply_tweet",
    like: "like_tweet",
    unlike: "unlike_tweet",
    retweet: "retweet_tweet",

    // Search
    search: "search_tweets",
    searchUsers: "search_users",
  } as const;

  // Expose v2 API with automatic rate limiting
  public readonly v2: any;

  constructor(config: RateLimitedClientConfig) {
    this.client = new TwitterApi({
      gameTwitterAccessToken: config.gameTwitterAccessToken,
    });
    this.workerId = config.workerId;
    this.defaultPriority = config.defaultPriority || "medium";
    this.gameToken = config.gameTwitterAccessToken;
    this.cacheConfig = {
      ttlHours: config.cache?.ttlHours || DEFAULT_CACHE_TTL_HOURS,
      maxEntries: config.cache?.maxEntries || MAX_CACHE_ENTRIES,
    };

    // Clean up cache if it's too large
    this.cleanupCache();

    // Create rate-limited proxy for v2 API
    this.v2 = this.createRateLimitedProxy(this.client.v2);

    appLogger.debug(
      {
        workerId: this.workerId,
        cacheTTL: this.cacheConfig.ttlHours + "h",
        cacheMaxEntries: this.cacheConfig.maxEntries,
      },
      "Rate-limited Twitter client initialized with user caching"
    );
  }

  /**
   * Clean up old cache entries and enforce size limits
   */
  private cleanupCache(): void {
    const now = Date.now();
    const ttlMs = this.cacheConfig.ttlHours! * 60 * 60 * 1000;

    // Remove expired entries
    for (const [key, entry] of userCache.entries()) {
      if (now - entry.cachedAt > ttlMs) {
        userCache.delete(key);
      }
    }

    // Enforce size limit (remove oldest entries)
    if (userCache.size > this.cacheConfig.maxEntries!) {
      const entries = Array.from(userCache.entries());
      entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);

      const toRemove = entries.slice(
        0,
        userCache.size - this.cacheConfig.maxEntries!
      );
      toRemove.forEach(([key]) => userCache.delete(key));

      appLogger.debug(
        { removed: toRemove.length, remaining: userCache.size },
        "Cache cleanup completed"
      );
    }
  }

  /**
   * Get current user ID with automatic caching and retry logic
   * This is a high-level method that handles caching and rate limiting automatically
   */
  async getCurrentUserId(
    forceRefresh = false
  ): Promise<{ id: string; username: string }> {
    const cacheKey = this.gameToken;
    const now = Date.now();

    // Check cache first (unless forced refresh)
    if (!forceRefresh) {
      const cached = userCache.get(cacheKey);
      if (
        cached &&
        now - cached.cachedAt < this.cacheConfig.ttlHours! * 60 * 60 * 1000
      ) {
        appLogger.debug(
          {
            userId: cached.userId,
            username: cached.username,
            cacheAge: now - cached.cachedAt,
          },
          "Using cached user ID (no API call needed)"
        );
        return { id: cached.userId, username: cached.username };
      }
    }

    // Need to make API call - check rate limits first
    const rateLimitCheck = await globalRateLimiter.canMakeRequest(
      "get_user",
      this.workerId,
      this.defaultPriority
    );

    if (!rateLimitCheck.allowed) {
      const error = new Error(
        `Rate limited: ${rateLimitCheck.reason}. Retry in ${rateLimitCheck.retry_after_seconds}s`
      );
      (error as any).code = 429;
      (error as any).retryAfter = rateLimitCheck.retry_after_seconds;

      appLogger.warn(
        {
          endpoint: "get_user",
          workerId: this.workerId,
          reason: rateLimitCheck.reason,
          retry_after: rateLimitCheck.retry_after_seconds,
        },
        "User ID API call blocked by rate limiter"
      );
      throw error;
    }

    // Make the API call with enhanced error handling
    try {
      const response = await this.client.v2.me();
      const userId = response.data.id;
      const username = response.data.username;

      // Cache the result
      userCache.set(cacheKey, {
        userId,
        username,
        gameToken: this.gameToken,
        cachedAt: now,
      });

      // Record successful usage
      await globalRateLimiter.recordUsage(
        "get_user",
        this.workerId,
        true,
        this.extractRateLimitHeaders(response)
      );

      appLogger.info(
        {
          userId,
          username,
          forceRefresh,
          cacheSize: userCache.size,
        },
        "User ID fetched and cached (consumed 1 get_user rate limit)"
      );

      return { id: userId, username };
    } catch (error: any) {
      // Record failed usage
      await globalRateLimiter.recordUsage("get_user", this.workerId, false);

      // Enhanced error categorization
      if (error.code === 401) {
        appLogger.error(
          { error: error.message },
          "Authentication failed - check GAME_TWITTER_TOKEN"
        );
        throw new Error(
          `Authentication failed: Invalid or expired GAME_TWITTER_TOKEN`
        );
      } else if (error.code >= 500) {
        appLogger.error(
          { error: error.message, code: error.code },
          "Twitter API server error - temporary issue"
        );
        throw new Error(
          `Twitter API server error (${error.code}): ${error.message}`
        );
      } else {
        appLogger.error(
          { error: error.message, code: error.code, endpoint: "get_user" },
          "Unexpected API error"
        );
        throw error;
      }
    }
  }

  /**
   * Clear user cache (useful for testing or token changes)
   */
  clearUserCache(): void {
    userCache.delete(this.gameToken);
    appLogger.debug("User cache cleared for current token");
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): { hasCachedUser: boolean; cacheAge?: number } {
    const cached = userCache.get(this.gameToken);
    if (!cached) {
      return { hasCachedUser: false };
    }
    return {
      hasCachedUser: true,
      cacheAge: Date.now() - cached.cachedAt,
    };
  }

  /**
   * Fetch mentions with automatic user ID resolution and proper rate limit tracking
   * This method tracks BOTH get_user and fetch_mentions rate limits
   */
  async fetchUserMentions(
    options: {
      max_results?: number;
      since_id?: string;
      forceRefreshUser?: boolean;
    } = {}
  ): Promise<any> {
    // Step 1: Get user ID (tracks get_user if cache miss)
    const userInfo = await this.getCurrentUserId(
      options.forceRefreshUser || false
    );

    // Step 2: Check fetch_mentions rate limit
    const rateLimitCheck = await globalRateLimiter.canMakeRequest(
      "fetch_mentions",
      this.workerId,
      "high"
    );

    if (!rateLimitCheck.allowed) {
      const error = new Error(
        `Rate limited: ${rateLimitCheck.reason}. Retry in ${rateLimitCheck.retry_after_seconds}s`
      );
      (error as any).code = 429;
      appLogger.warn(
        {
          endpoint: "fetch_mentions",
          workerId: this.workerId,
          reason: rateLimitCheck.reason,
          retry_after: rateLimitCheck.retry_after_seconds,
        },
        "Mentions API call blocked by rate limiter"
      );
      throw error;
    }

    // Step 3: Make the mentions API call
    try {
      const timelineParams: any = {
        max_results: options.max_results || 50,
        expansions: ["author_id", "referenced_tweets.id"],
        "tweet.fields": ["created_at", "public_metrics", "referenced_tweets"],
        "user.fields": [
          "id",
          "username",
          "name",
          "description",
          "location",
          "profile_image_url",
          "url",
          "verified",
          "verified_type",
          "protected",
          "created_at",
          "public_metrics",
          "pinned_tweet_id",
        ],
      };
      if (options.since_id) timelineParams.since_id = options.since_id;

      const response = await this.client.v2.userMentionTimeline(
        userInfo.id,
        timelineParams
      );

      // Step 4: Record fetch_mentions usage
      await globalRateLimiter.recordUsage(
        "fetch_mentions",
        this.workerId,
        true,
        this.extractRateLimitHeaders(response)
      );

      appLogger.info(
        {
          result_count: response.data.meta?.result_count || 0,
          user_id: userInfo.id,
          rate_limit_remaining: response.rateLimit?.remaining,
        },
        "Mentions fetched successfully with proper dual rate limit tracking"
      );

      return response;
    } catch (error: any) {
      // Record failed fetch_mentions usage
      await globalRateLimiter.recordUsage(
        "fetch_mentions",
        this.workerId,
        false
      );
      throw error;
    }
  }

  /**
   * Create a proxy that intercepts method calls and applies rate limiting
   */
  private createRateLimitedProxy(target: any): any {
    return new Proxy(target, {
      get: (obj, prop: string) => {
        const originalMethod = obj[prop];

        // If it's not a function, return as-is (properties, etc.)
        if (typeof originalMethod !== "function") {
          return originalMethod;
        }

        // Return rate-limited wrapper function
        return async (...args: any[]) => {
          const endpoint =
            RateLimitedTwitterClient.METHOD_ENDPOINTS[
              prop as keyof typeof RateLimitedTwitterClient.METHOD_ENDPOINTS
            ];

          if (endpoint) {
            // Apply rate limiting before call
            await this.enforceRateLimit(endpoint, prop);
          }

          try {
            // Make the actual API call
            const startTime = Date.now();
            const result = await originalMethod.apply(obj, args);
            const duration = Date.now() - startTime;

            if (endpoint) {
              // Record successful usage and sync with Twitter
              await this.recordSuccess(endpoint, prop, result, duration);
            }

            return result;
          } catch (error: any) {
            if (endpoint) {
              // Record failed usage
              await this.recordFailure(endpoint, prop, error);
            }
            throw error; // Re-throw original error
          }
        };
      },
    });
  }

  /**
   * Enforce rate limiting before API call
   */
  private async enforceRateLimit(
    endpoint: string,
    method: string
  ): Promise<void> {
    const priority = this.getPriorityForEndpoint(endpoint);

    const rateLimitCheck = await globalRateLimiter.canMakeRequest(
      endpoint,
      this.workerId,
      priority
    );

    if (!rateLimitCheck.allowed) {
      const errorMsg = `Rate limited: ${rateLimitCheck.reason}. Retry in ${rateLimitCheck.retry_after_seconds}s`;

      appLogger.warn(
        {
          endpoint,
          method,
          workerId: this.workerId,
          reason: rateLimitCheck.reason,
          retry_after: rateLimitCheck.retry_after_seconds,
        },
        "API call blocked by rate limiter"
      );

      // Throw error that matches Twitter API format
      const error = new Error(errorMsg);
      (error as any).code = 429; // Rate limit error code
      (error as any).rateLimit = {
        reset:
          Math.floor(Date.now() / 1000) +
          (rateLimitCheck.retry_after_seconds || 60),
      };
      throw error;
    }

    appLogger.debug(
      { endpoint, method, workerId: this.workerId, priority },
      "Rate limit check passed, proceeding with API call"
    );
  }

  /**
   * Record successful API call and sync with Twitter
   */
  private async recordSuccess(
    endpoint: string,
    method: string,
    result: any,
    duration: number
  ): Promise<void> {
    // Extract Twitter's rate limit headers from response
    const rateLimitHeaders = this.extractRateLimitHeaders(result);

    // Record usage in our local tracking
    await globalRateLimiter.recordUsage(
      endpoint,
      this.workerId,
      true,
      rateLimitHeaders
    );

    // Sync with Twitter's actual rate limits if available
    if (result?.rateLimit) {
      await globalRateLimiter.syncWithTwitter(endpoint, {
        limit: result.rateLimit.limit,
        remaining: result.rateLimit.remaining,
        reset: result.rateLimit.reset,
      });
    }

    appLogger.debug(
      {
        endpoint,
        method,
        workerId: this.workerId,
        duration,
        twitter_remaining: rateLimitHeaders?.["x-rate-limit-remaining"],
      },
      "API call completed successfully"
    );
  }

  /**
   * Record failed API call
   */
  private async recordFailure(
    endpoint: string,
    method: string,
    error: any
  ): Promise<void> {
    // Only record usage for non-rate-limit errors (429)
    const shouldRecord = error.code !== 429;

    if (shouldRecord) {
      await globalRateLimiter.recordUsage(endpoint, this.workerId, false);
    }

    appLogger.warn(
      {
        endpoint,
        method,
        workerId: this.workerId,
        error: error.message,
        errorCode: error.code,
        recorded: shouldRecord,
      },
      "API call failed"
    );
  }

  /**
   * Get priority level for endpoint
   */
  private getPriorityForEndpoint(
    endpoint: string
  ): "low" | "medium" | "high" | "critical" {
    const priorityMap = {
      fetch_mentions: "high", // Important for real-time responses
      get_user: "medium", // Needed for user info
      reply_tweet: "critical", // User interaction is critical
      like_tweet: "low", // Nice to have
      search_tweets: "medium", // Content discovery
    } as const;

    return (
      priorityMap[endpoint as keyof typeof priorityMap] || this.defaultPriority
    );
  }

  /**
   * Extract rate limit headers from API response
   */
  private extractRateLimitHeaders(
    result: any
  ): Record<string, string> | undefined {
    if (result?.rateLimit) {
      return {
        "x-rate-limit-remaining": result.rateLimit.remaining?.toString() || "0",
        "x-rate-limit-reset": result.rateLimit.reset?.toString() || "0",
        "x-rate-limit-limit": result.rateLimit.limit?.toString() || "0",
      };
    }
    return undefined;
  }
}

/**
 * Factory function for easy creation
 */
export function createRateLimitedTwitterClient(
  options: RateLimitedClientConfig
): RateLimitedTwitterClient {
  return new RateLimitedTwitterClient(options);
}
