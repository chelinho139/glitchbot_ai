import { DatabaseManager, databaseManager } from "../../lib/database-manager";
import appLogger from "../../lib/log";

export interface RateLimitWindow {
  window_type: "per_15min" | "per_hour" | "per_day";
  limit: number;
  used: number;
  reset_time: string;
  worker_usage: Map<string, number>;
}

export interface RateLimitConfig {
  endpoint: string;
  requests_per_15min: number;
  requests_per_hour: number;
  requests_per_day: number;
  worker_fair_share: boolean;
}

export class GlobalRateLimiter {
  private dbManager: DatabaseManager;
  private _configs: Map<string, RateLimitConfig> = new Map();

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager || databaseManager;
    this.initializeRateLimits();
    // Database schema already created by DatabaseManager
  }

  /**
   * Get database instance for direct access
   */
  get db_instance(): any {
    return this.dbManager.database;
  }

  // Database schema initialization now handled by DatabaseManager

  /**
   * Initialize Twitter API rate limits - MODIFIED FOR TESTING: 1 per minute for all endpoints
   */
  private initializeRateLimits(): void {
    // TESTING CONFIGURATION: All endpoints limited to 1 request per minute
    // This allows for easier testing and development without hitting real Twitter limits

    this._configs.set("fetch_mentions", {
      endpoint: "fetch_mentions",
      requests_per_15min: 15, // 1 per minute = 15 per 15 minutes
      requests_per_hour: 60, // 1 per minute = 60 per hour
      requests_per_day: 1440, // 1 per minute = 1440 per day
      worker_fair_share: true,
    });

    this._configs.set("get_user", {
      endpoint: "get_user",
      requests_per_15min: 15, // 1 per minute = 15 per 15 minutes
      requests_per_hour: 60, // 1 per minute = 60 per hour
      requests_per_day: 1440, // 1 per minute = 1440 per day
      worker_fair_share: true,
    });

    this._configs.set("reply_tweet", {
      endpoint: "reply_tweet",
      requests_per_15min: 15, // 1 per minute = 15 per 15 minutes
      requests_per_hour: 60, // 1 per minute = 60 per hour
      requests_per_day: 1440, // 1 per minute = 1440 per day
      worker_fair_share: false, // Priority for replies
    });

    this._configs.set("like_tweet", {
      endpoint: "like_tweet",
      requests_per_15min: 15, // 1 per minute = 15 per 15 minutes
      requests_per_hour: 60, // 1 per minute = 60 per hour
      requests_per_day: 1440, // 1 per minute = 1440 per day
      worker_fair_share: true,
    });

    this._configs.set("search_tweets", {
      endpoint: "search_tweets",
      requests_per_15min: 15, // 1 per minute = 15 per 15 minutes
      requests_per_hour: 60, // 1 per minute = 60 per hour
      requests_per_day: 1440, // 1 per minute = 1440 per day
      worker_fair_share: true,
    });

    this._configs.set("fetch_timeline", {
      endpoint: "fetch_timeline",
      requests_per_15min: 15, // 1 per minute = 15 per 15 minutes
      requests_per_hour: 60, // 1 per minute = 60 per hour
      requests_per_day: 1440, // 1 per minute = 1440 per day
      worker_fair_share: true,
    });

    this._configs.set("post_tweet", {
      endpoint: "post_tweet",
      requests_per_15min: 15, // 1 per minute = 15 per 15 minutes
      requests_per_hour: 60, // 1 per minute = 60 per hour
      requests_per_day: 1440, // 1 per minute = 1440 per day
      worker_fair_share: false, // Priority for posting
    });

    appLogger.info(
      { endpoints: Array.from(this._configs.keys()) },
      "Rate limiter initialized with TESTING LIMITS: 1 request per minute for all endpoints"
    );
  }

  /**
   * Get current time window starts
   */
  private getWindowStarts(now = new Date()): {
    per_15min: number;
    per_hour: number;
    per_day: number;
  } {
    const timestamp = now.getTime();
    return {
      per_15min: Math.floor(timestamp / (15 * 60 * 1000)) * (15 * 60 * 1000),
      per_hour: Math.floor(timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000),
      per_day:
        Math.floor(timestamp / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000),
    };
  }

  /**
   * Get current usage for endpoint and window (legacy method)
   */
  private getCurrentUsage(
    endpoint: string,
    windowType: "per_15min" | "per_hour" | "per_day",
    windowStart: number
  ): { total: number; workerUsage: Map<string, number> } {
    // Use the enhanced version internally, but return legacy interface
    const enhanced = this.getCurrentUsageWithReset(
      endpoint,
      windowType,
      windowStart,
      new Date()
    );
    return {
      total: enhanced.total,
      workerUsage: enhanced.workerUsage,
    };
  }

  /**
   * Get current usage for endpoint and window with Twitter reset time awareness
   */
  private getCurrentUsageWithReset(
    endpoint: string,
    windowType: "per_15min" | "per_hour" | "per_day",
    windowStart: number,
    now: Date
  ): {
    total: number;
    workerUsage: Map<string, number>;
    twitterResetTime?: number;
  } {
    const stmt = this.dbManager.database.prepare(`
      SELECT requests_used, worker_usage, twitter_reset_time 
      FROM rate_limits 
      WHERE endpoint = ? AND window_type = ? AND window_start = ?
    `);

    const result = stmt.get(endpoint, windowType, windowStart) as any;

    if (!result) {
      return { total: 0, workerUsage: new Map() };
    }

    // Check if Twitter reset time has passed
    const twitterResetTime = result.twitter_reset_time;
    if (twitterResetTime && now.getTime() / 1000 >= twitterResetTime) {
      // Twitter reset time has passed, treat as if no usage
      appLogger.debug(
        {
          endpoint,
          windowType,
          twitterResetTime: new Date(twitterResetTime * 1000).toISOString(),
          now: now.toISOString(),
        },
        "Twitter reset time has passed, ignoring stored usage"
      );
      return { total: 0, workerUsage: new Map(), twitterResetTime };
    }

    const workerUsageObj = JSON.parse(result.worker_usage || "{}");
    const workerUsage = new Map<string, number>();
    Object.entries(workerUsageObj).forEach(([key, value]) => {
      workerUsage.set(key, Number(value) || 0);
    });

    return {
      total: result.requests_used || 0,
      workerUsage,
      twitterResetTime,
    };
  }

  /**
   * Calculate reset seconds using Twitter's actual reset time or fallback to math
   */
  private calculateResetSeconds(
    twitterResetTime: number | undefined,
    windowStart: number,
    windowDurationSeconds: number,
    now: Date
  ): number {
    const nowTimestamp = now.getTime();

    if (twitterResetTime) {
      // Use Twitter's actual reset time
      const resetSeconds = Math.max(
        0,
        twitterResetTime - Math.floor(nowTimestamp / 1000)
      );
      appLogger.debug(
        {
          twitterResetTime: new Date(twitterResetTime * 1000).toISOString(),
          resetSeconds,
        },
        "Using Twitter's actual reset time"
      );
      return resetSeconds;
    } else {
      // Fall back to mathematical calculation
      const resetSeconds =
        windowDurationSeconds - Math.floor((nowTimestamp - windowStart) / 1000);
      appLogger.debug(
        {
          windowStart: new Date(windowStart).toISOString(),
          windowDuration: windowDurationSeconds,
          resetSeconds,
        },
        "Using mathematical reset calculation (no Twitter reset time available)"
      );
      return Math.max(0, resetSeconds);
    }
  }

  /**
   * Update usage for endpoint and window
   */
  private updateUsage(
    endpoint: string,
    windowType: "per_15min" | "per_hour" | "per_day",
    windowStart: number,
    workerId: string,
    increment = 1,
    twitterResetTime?: number
  ): void {
    const current = this.getCurrentUsage(endpoint, windowType, windowStart);
    const newWorkerUsage = new Map(current.workerUsage);

    newWorkerUsage.set(
      workerId,
      (newWorkerUsage.get(workerId) || 0) + increment
    );

    const stmt = this.dbManager.database.prepare(`
      INSERT OR REPLACE INTO rate_limits 
      (endpoint, window_type, window_start, requests_used, worker_usage, twitter_reset_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      endpoint,
      windowType,
      windowStart,
      current.total + increment,
      JSON.stringify(Object.fromEntries(newWorkerUsage)),
      twitterResetTime
    );
  }

  /**
   * Check if request is allowed under rate limits
   */
  async canMakeRequest(
    endpoint: string,
    workerId: string,
    priority: "low" | "medium" | "high" | "critical" = "medium"
  ): Promise<{
    allowed: boolean;
    retry_after_seconds?: number;
    reason?: string;
  }> {
    const config = this._configs.get(endpoint);
    if (!config) {
      appLogger.debug(
        { endpoint },
        "No rate limit config found, allowing request"
      );
      return { allowed: true }; // Allow if no config
    }

    const windows = this.getWindowStarts();
    const now = new Date();

    // Check ALL time windows - any one can block the request

    // Check 15-minute window
    const usage15min = this.getCurrentUsageWithReset(
      endpoint,
      "per_15min",
      windows.per_15min,
      now
    );

    if (usage15min.total >= config.requests_per_15min) {
      const resetSeconds = this.calculateResetSeconds(
        usage15min.twitterResetTime,
        windows.per_15min,
        15 * 60,
        now
      );

      appLogger.warn(
        {
          endpoint,
          workerId,
          used: usage15min.total,
          limit: config.requests_per_15min,
          resetIn: resetSeconds,
          usingTwitterReset: !!usage15min.twitterResetTime,
        },
        "15-minute rate limit exceeded"
      );

      return {
        allowed: false,
        retry_after_seconds: resetSeconds,
        reason: `15min limit exceeded (${usage15min.total}/${config.requests_per_15min})`,
      };
    }

    // Check hourly window
    const usageHour = this.getCurrentUsageWithReset(
      endpoint,
      "per_hour",
      windows.per_hour,
      now
    );

    if (usageHour.total >= config.requests_per_hour) {
      const resetSeconds = this.calculateResetSeconds(
        usageHour.twitterResetTime,
        windows.per_hour,
        60 * 60,
        now
      );

      appLogger.warn(
        {
          endpoint,
          workerId,
          used: usageHour.total,
          limit: config.requests_per_hour,
          resetIn: resetSeconds,
          usingTwitterReset: !!usageHour.twitterResetTime,
        },
        "Hourly rate limit exceeded"
      );

      return {
        allowed: false,
        retry_after_seconds: resetSeconds,
        reason: `Hourly limit exceeded (${usageHour.total}/${config.requests_per_hour})`,
      };
    }

    // Check daily window
    const usageDay = this.getCurrentUsageWithReset(
      endpoint,
      "per_day",
      windows.per_day,
      now
    );

    if (usageDay.total >= config.requests_per_day) {
      const resetSeconds = this.calculateResetSeconds(
        usageDay.twitterResetTime,
        windows.per_day,
        24 * 60 * 60,
        now
      );

      appLogger.warn(
        {
          endpoint,
          workerId,
          used: usageDay.total,
          limit: config.requests_per_day,
          resetIn: resetSeconds,
          usingTwitterReset: !!usageDay.twitterResetTime,
        },
        "Daily rate limit exceeded"
      );

      return {
        allowed: false,
        retry_after_seconds: resetSeconds,
        reason: `Daily limit exceeded (${usageDay.total}/${config.requests_per_day})`,
      };
    }

    // Check worker fair share if enabled (only for non-critical requests)
    if (config.worker_fair_share && priority !== "critical") {
      const activeWorkers = Math.max(1, usage15min.workerUsage.size || 1);
      const fairShare = Math.floor(config.requests_per_15min / activeWorkers);
      const workerUsage = usage15min.workerUsage.get(workerId) || 0;

      if (workerUsage >= fairShare) {
        const resetSeconds =
          15 * 60 - Math.floor((now.getTime() - windows.per_15min) / 1000);
        return {
          allowed: false,
          retry_after_seconds: resetSeconds,
          reason: `Worker fair share exceeded (${workerUsage}/${fairShare})`,
        };
      }
    }

    appLogger.debug(
      {
        endpoint,
        workerId,
        used: usage15min.total,
        limit: config.requests_per_15min,
      },
      "Rate limit check passed"
    );

    return { allowed: true };
  }

  /**
   * Record API request usage
   */
  async recordUsage(
    endpoint: string,
    workerId: string,
    success: boolean,
    responseHeaders?: Record<string, string>
  ): Promise<void> {
    if (!success) {
      appLogger.debug(
        { endpoint, workerId },
        "Not recording usage for failed request"
      );
      return;
    }

    const windows = this.getWindowStarts();

    // Extract Twitter's reset time if available
    let twitterResetTime: number | undefined;
    if (responseHeaders?.["x-rate-limit-reset"]) {
      twitterResetTime = parseInt(responseHeaders["x-rate-limit-reset"]);
    }

    // Update all time windows
    this.updateUsage(
      endpoint,
      "per_15min",
      windows.per_15min,
      workerId,
      1,
      twitterResetTime
    );
    this.updateUsage(
      endpoint,
      "per_hour",
      windows.per_hour,
      workerId,
      1,
      twitterResetTime
    );
    this.updateUsage(
      endpoint,
      "per_day",
      windows.per_day,
      workerId,
      1,
      twitterResetTime
    );

    // Log Twitter API rate limit headers if available
    if (responseHeaders) {
      const remaining = responseHeaders["x-rate-limit-remaining"];
      const reset = responseHeaders["x-rate-limit-reset"];

      if (remaining || reset) {
        appLogger.debug(
          {
            endpoint,
            workerId,
            twitter_remaining: remaining,
            twitter_reset: reset,
            twitter_reset_time: twitterResetTime
              ? new Date(twitterResetTime * 1000).toISOString()
              : undefined,
          },
          "Twitter API rate limit headers recorded"
        );
      }
    }

    appLogger.debug({ endpoint, workerId }, "API usage recorded successfully");
  }

  /**
   * Synchronize with Twitter's actual rate limits
   */
  async syncWithTwitter(
    endpoint: string,
    twitterRateLimit: { limit: number; remaining: number; reset: number }
  ): Promise<void> {
    const resetTime = new Date(twitterRateLimit.reset * 1000);

    // Calculate how many requests Twitter thinks we've used
    const twitterUsed = twitterRateLimit.limit - twitterRateLimit.remaining;

    // Get our local tracking for 15-minute window
    const windows = this.getWindowStarts();
    const localUsage = this.getCurrentUsage(
      endpoint,
      "per_15min",
      windows.per_15min
    );

    // If there's a significant discrepancy, log it
    const discrepancy = Math.abs(localUsage.total - twitterUsed);
    if (discrepancy > 2) {
      // Allow small differences due to timing
      appLogger.warn(
        {
          endpoint,
          localUsed: localUsage.total,
          twitterUsed,
          twitterRemaining: twitterRateLimit.remaining,
          discrepancy,
          resetTime: resetTime.toISOString(),
        },
        "Rate limit discrepancy detected between local tracking and Twitter"
      );
    } else {
      appLogger.debug(
        {
          endpoint,
          twitter_remaining: twitterRateLimit.remaining,
          twitter_limit: twitterRateLimit.limit,
          local_used: localUsage.total,
        },
        "Rate limit in sync with Twitter API"
      );
    }
  }

  /**
   * Get remaining capacity for endpoint
   */
  async getRemainingCapacity(endpoint: string): Promise<{
    per_15min: { remaining: number; resets_at: string };
    per_hour: { remaining: number; resets_at: string };
    per_day: { remaining: number; resets_at: string };
  }> {
    const config = this._configs.get(endpoint);
    if (!config) {
      const now = new Date();
      return {
        per_15min: { remaining: 0, resets_at: now.toISOString() },
        per_hour: { remaining: 0, resets_at: now.toISOString() },
        per_day: { remaining: 0, resets_at: now.toISOString() },
      };
    }

    const windows = this.getWindowStarts();

    const usage15min = this.getCurrentUsage(
      endpoint,
      "per_15min",
      windows.per_15min
    );
    const usageHour = this.getCurrentUsage(
      endpoint,
      "per_hour",
      windows.per_hour
    );
    const usageDay = this.getCurrentUsage(endpoint, "per_day", windows.per_day);

    return {
      per_15min: {
        remaining: Math.max(0, config.requests_per_15min - usage15min.total),
        resets_at: new Date(windows.per_15min + 15 * 60 * 1000).toISOString(),
      },
      per_hour: {
        remaining: Math.max(0, config.requests_per_hour - usageHour.total),
        resets_at: new Date(windows.per_hour + 60 * 60 * 1000).toISOString(),
      },
      per_day: {
        remaining: Math.max(0, config.requests_per_day - usageDay.total),
        resets_at: new Date(
          windows.per_day + 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    };
  }

  /**
   * Clean up old usage history
   */
  async cleanup(): Promise<void> {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

    const stmt = this.dbManager.database.prepare(`
      DELETE FROM rate_limits 
      WHERE window_start < ?
    `);

    const result = stmt.run(cutoff);

    appLogger.info(
      { deleted_records: result.changes },
      "Rate limiter cleanup completed"
    );
  }

  /**
   * Reset rate limits for testing purposes (USE WITH CAUTION)
   */
  async resetLimitsForTesting(endpoint?: string): Promise<void> {
    let stmt;
    let result;

    if (endpoint) {
      stmt = this.dbManager.database.prepare(
        `DELETE FROM rate_limits WHERE endpoint = ?`
      );
      result = stmt.run(endpoint);
      appLogger.warn(
        { endpoint, deleted_records: result.changes },
        "Rate limits reset for specific endpoint (TESTING ONLY)"
      );
    } else {
      stmt = this.dbManager.database.prepare(`DELETE FROM rate_limits`);
      result = stmt.run();
      appLogger.warn(
        { deleted_records: result.changes },
        "ALL rate limits reset (TESTING ONLY)"
      );
    }
  }

  /**
   * Get detailed system status for monitoring
   */
  async getSystemStatus(): Promise<{
    endpoints: string[];
    totalUsage: number;
    oldestWindow: string;
    newestWindow: string;
    cacheHits: number;
  }> {
    const stmt = this.dbManager.database.prepare(`
      SELECT 
        COUNT(DISTINCT endpoint) as endpoints,
        SUM(requests_used) as total_usage,
        MIN(datetime(window_start/1000, 'unixepoch')) as oldest_window,
        MAX(datetime(window_start/1000, 'unixepoch')) as newest_window
      FROM rate_limits
      WHERE requests_used > 0
    `);

    const result = stmt.get() as any;

    return {
      endpoints: Array.from(this._configs.keys()),
      totalUsage: result.total_usage || 0,
      oldestWindow: result.oldest_window || "none",
      newestWindow: result.newest_window || "none",
      cacheHits: 0, // Would need to track this separately
    };
  }
}

// Global singleton instance
export const globalRateLimiter = new GlobalRateLimiter();
