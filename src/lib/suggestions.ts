import GlitchBotDB from "./db";
import appLogger from "./log";

// Minimal timeline-like tweet shape compatible with TimelineTweet
export interface BasicTimelineTweet {
  id: string;
  text: string;
  author_id: string;
  author?: {
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
  };
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
    bookmark_count: number;
    impression_count: number;
  };
  referenced_tweets?: Array<{ type: string; id: string }>;
  context_annotations?: Array<{
    domain: { id: string; name: string; description?: string };
    entity: { id: string; name: string; description?: string };
  }>;
}

export interface FetchSuggestionsOptions {
  windowHours: number;
  limit: number;
  selfUsername?: string | undefined;
}

/**
 * Fetch up to `limit` recent suggested tweets discovered via mentions within the last `windowHours`.
 * Normalizes rows into a Timeline-like shape with author.username populated.
 */
export function fetchRecentSuggestedAsTimelineTweets(
  db: GlitchBotDB,
  options: FetchSuggestionsOptions
): BasicTimelineTweet[] {
  const { windowHours, limit, selfUsername } = options;
  // cutoff calculated internally by DB helper; retained here previously but no longer needed

  try {
    const rows = db.getRecentSuggestedTweetRowsByMentionWindow(
      windowHours,
      limit
    );

    const suggestions: BasicTimelineTweet[] = [];
    for (const row of rows || []) {
      if (
        !row.tweet_id ||
        !row.author_id ||
        !row.author_username ||
        !row.content ||
        !row.created_at
      ) {
        continue;
      }

      const t: BasicTimelineTweet = {
        id: String(row.tweet_id),
        text: String(row.content),
        author_id: String(row.author_id),
        author: {
          id: String(row.author_id),
          username: String(row.author_username),
        },
        created_at: String(row.created_at),
      };

      if (row.public_metrics) {
        try {
          const pm = JSON.parse(row.public_metrics);
          t.public_metrics = {
            retweet_count: pm.retweet_count || 0,
            like_count: pm.like_count || 0,
            reply_count: pm.reply_count || 0,
            quote_count: pm.quote_count || 0,
            bookmark_count: pm.bookmark_count || 0,
            impression_count: pm.impression_count || 0,
          };
        } catch (_e) {
          // ignore malformed metrics
        }
      }

      suggestions.push(t);
    }

    // Exclude self-authored tweets if configured
    const filtered = selfUsername
      ? suggestions.filter(
          (t) => (t.author?.username || "").toLowerCase() !== selfUsername
        )
      : suggestions;

    return filtered;
  } catch (error: any) {
    appLogger.error(
      { error: error.message },
      "fetchRecentSuggestedAsTimelineTweets: Failed to fetch suggestions"
    );
    return [];
  }
}
