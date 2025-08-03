import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import GlitchBotDB from "../../../lib/db";
import appLogger from "../../../lib/log";

export interface StorePendingMentionsArgs {
  mentions: string; // JSON array of mention objects
  fetch_id: string; // ID of the fetch operation
}

function calculatePriority(): number {
  // Simple priority calculation - everyone gets same priority for now
  // Priority 5 = default priority for all mentions
  // This can be enhanced later with intent analysis or other factors

  return 5; // Default priority for all mentions
}

export const storePendingMentionsFunction = new GameFunction({
  name: "store_pending_mentions",
  description:
    "Store fetched mentions in persistent queue for processing to prevent data loss",
  args: [
    {
      name: "mentions",
      description: "JSON array of mention objects to store in queue",
    },
    {
      name: "fetch_id",
      description: "ID of the fetch operation for tracking and debugging",
    },
  ] as const,
  executable: async (args, logger) => {
    const startTime = Date.now();

    try {
      logger("Starting to store pending mentions");
      appLogger.info(
        {
          fetch_id: args.fetch_id,
        },
        "store_pending_mentions: Starting operation"
      );

      if (!args.mentions) {
        appLogger.error(
          "store_pending_mentions: mentions parameter is required"
        );
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "mentions parameter is required"
        );
      }

      const mentions = JSON.parse(args.mentions);
      if (!Array.isArray(mentions)) {
        appLogger.error("store_pending_mentions: mentions must be an array");
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "mentions must be a JSON array"
        );
      }

      const db = new GlitchBotDB();
      let storedCount = 0;
      let skippedCount = 0;

      for (const mention of mentions) {
        try {
          // Validate required fields
          if (
            !mention.id ||
            !mention.text ||
            !mention.author_id ||
            !mention.created_at
          ) {
            appLogger.warn(
              { mention_id: mention.id || "unknown" },
              "store_pending_mentions: Skipping mention with missing required fields"
            );
            skippedCount++;
            continue;
          }

          const priority = calculatePriority();
          const authorUsername = mention.author?.username || "unknown";

          // Insert or replace (in case of duplicate fetch)
          db.database
            .prepare(
              `
            INSERT OR REPLACE INTO pending_mentions 
            (mention_id, author_id, author_username, text, created_at, 
             status, priority, original_fetch_id)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
          `
            )
            .run([
              mention.id,
              mention.author_id,
              authorUsername,
              mention.text,
              mention.created_at,
              priority,
              args.fetch_id,
            ]);

          storedCount++;

          appLogger.debug(
            {
              mention_id: mention.id,
              author: authorUsername,
              priority,
              text_preview: (mention.text || "").substring(0, 50) + "...",
            },
            "store_pending_mentions: Stored mention in queue"
          );
        } catch (error: any) {
          appLogger.error(
            {
              mention_id: mention.id || "unknown",
              error: error.message,
            },
            "store_pending_mentions: Failed to store individual mention"
          );
          skippedCount++;
        }
      }

      const executionTime = Date.now() - startTime;

      appLogger.info(
        {
          stored_count: storedCount,
          skipped_count: skippedCount,
          total_mentions: mentions.length,
          execution_time_ms: executionTime,
          fetch_id: args.fetch_id,
        },
        "store_pending_mentions: Operation completed"
      );

      logger(
        `Stored ${storedCount} mentions in queue (${skippedCount} skipped)`
      );

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify({
          stored_count: storedCount,
          skipped_count: skippedCount,
          total_mentions: mentions.length,
          fetch_id: args.fetch_id,
        })
      );
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      appLogger.error(
        {
          error: error.message,
          stack: error.stack,
          execution_time_ms: executionTime,
          fetch_id: args.fetch_id,
        },
        "store_pending_mentions: Unexpected error occurred"
      );

      logger(`Failed to store mentions: ${error.message}`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Unexpected error: ${error.message}`
      );
    }
  },
});

export default storePendingMentionsFunction;
