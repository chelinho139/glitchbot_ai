import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import GlitchBotDB from "../../../lib/db";
import { globalRateLimiter } from "../../../persistence/global/rate-limiter";
import appLogger from "../../../lib/log";

export interface ProcessableMention {
  mention_id: string;
  author_id: string;
  author_username: string;
  text: string;
  created_at: string;
  priority: number;
  retry_count: number;
}

export const getProcessableMentionsFunction = new GameFunction({
  name: "get_processable_mentions",
  description:
    "Get mentions ready for processing based on current rate limits and priorities",
  args: [
    {
      name: "max_count",
      description: "Maximum number of mentions to return for processing",
    },
    {
      name: "priority_filter",
      description: "Optional priority filter (1-10, lower = higher priority)",
    },
  ] as const,
  executable: async (args, logger) => {
    const startTime = Date.now();

    try {
      logger("Getting processable mentions from queue");
      appLogger.info(
        {
          max_count: args.max_count,
          priority_filter: args.priority_filter,
        },
        "get_processable_mentions: Starting operation"
      );

      // Check rate limit capacity for replies
      const capacity = await globalRateLimiter.getRemainingCapacity(
        "reply_tweet"
      );
      const remainingReplies = capacity.per_hour.remaining;

      appLogger.debug(
        {
          remaining_replies: remainingReplies,
          reset_time: capacity.per_hour.resets_at,
        },
        "get_processable_mentions: Checked rate limit capacity"
      );

      if (remainingReplies === 0) {
        appLogger.info(
          "get_processable_mentions: No rate limit capacity available"
        );
        logger("No rate limit capacity available for replies");

        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Done,
          JSON.stringify({
            mentions: [],
            processable_count: 0,
            reason: "no_rate_limit_capacity",
            next_reset: capacity.per_hour.resets_at,
          })
        );
      }

      const maxCount = parseInt(args.max_count || "5");
      const maxProcessable = Math.min(maxCount, remainingReplies);

      const db = new GlitchBotDB();

      // Build query with optional priority filter
      let query = `
        SELECT mention_id, author_id, author_username, text, created_at, 
               priority, retry_count
        FROM pending_mentions 
        WHERE status IN ('pending', 'failed') 
          AND retry_count < 3
      `;

      const queryParams: any[] = [];

      if (args.priority_filter) {
        const priorityLimit = parseInt(args.priority_filter);
        query += ` AND priority <= ?`;
        queryParams.push(priorityLimit);
      }

      query += ` ORDER BY priority ASC, created_at ASC LIMIT ?`;
      queryParams.push(maxProcessable);

      const mentions = db.database
        .prepare(query)
        .all(queryParams) as ProcessableMention[];

      // Mark selected mentions as 'processing'
      if (mentions.length > 0) {
        const mentionIds = mentions.map((m) => m.mention_id);
        const placeholders = mentionIds.map(() => "?").join(",");

        db.database
          .prepare(
            `
          UPDATE pending_mentions 
          SET status = 'processing', worker_id = ?
          WHERE mention_id IN (${placeholders})
        `
          )
          .run(["mentions-worker", ...mentionIds]);

        appLogger.debug(
          {
            mention_ids: mentionIds,
            count: mentions.length,
          },
          "get_processable_mentions: Marked mentions as processing"
        );
      }

      const executionTime = Date.now() - startTime;

      appLogger.info(
        {
          processable_count: mentions.length,
          max_requested: maxCount,
          rate_limit_capacity: remainingReplies,
          execution_time_ms: executionTime,
        },
        "get_processable_mentions: Operation completed"
      );

      logger(
        `Found ${mentions.length} processable mentions (rate limit allows ${remainingReplies})`
      );

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify({
          mentions,
          processable_count: mentions.length,
          rate_limit_capacity: remainingReplies,
          next_reset: capacity.per_hour.resets_at,
        })
      );
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      appLogger.error(
        {
          error: error.message,
          stack: error.stack,
          execution_time_ms: executionTime,
        },
        "get_processable_mentions: Unexpected error occurred"
      );

      logger(`Failed to get processable mentions: ${error.message}`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Unexpected error: ${error.message}`
      );
    }
  },
});

export default getProcessableMentionsFunction;
