import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import GlitchBotDB from "../../../lib/db";
import appLogger from "../../../lib/log";

export const markMentionProcessedFunction = new GameFunction({
  name: "mark_mention_processed",
  description:
    "Mark mention as successfully processed and update engagement tracking",
  args: [
    {
      name: "mention_id",
      description: "ID of the mention that was processed",
    },
    {
      name: "action_taken",
      description: "Action taken: 'replied', 'delegated', 'escalated', etc",
    },
    {
      name: "reply_id",
      description: "Optional: ID of the reply tweet that was posted",
    },
  ] as const,
  executable: async (args, logger) => {
    const startTime = Date.now();

    try {
      logger("Marking mention as processed");
      appLogger.info(
        {
          mention_id: args.mention_id,
          action_taken: args.action_taken,
          reply_id: args.reply_id,
        },
        "mark_mention_processed: Starting operation"
      );

      if (!args.mention_id || !args.action_taken) {
        appLogger.error("mark_mention_processed: Missing required parameters");
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "mention_id and action_taken are required"
        );
      }

      const db = new GlitchBotDB();
      const now = new Date().toISOString();

      // Check if mention exists and is in processing state
      const mention = db.database
        .prepare(
          `
        SELECT mention_id, status, retry_count 
        FROM pending_mentions 
        WHERE mention_id = ?
      `
        )
        .get(args.mention_id) as any;

      if (!mention) {
        appLogger.warn(
          { mention_id: args.mention_id },
          "mark_mention_processed: Mention not found in queue"
        );
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          `Mention ${args.mention_id} not found in queue`
        );
      }

      if (mention.status === "completed") {
        appLogger.info(
          { mention_id: args.mention_id },
          "mark_mention_processed: Mention already marked as completed"
        );
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Done,
          `Mention ${args.mention_id} already processed`
        );
      }

      // Update pending_mentions table
      db.database
        .prepare(
          `
        UPDATE pending_mentions 
        SET status = 'completed', 
            processed_at = ?,
            worker_id = 'mentions-worker'
        WHERE mention_id = ?
      `
        )
        .run(now, args.mention_id);

      // Add to engaged_tweets table (existing table for tracking all engagements)
      const action = args.action_taken === "replied" ? "reply" : "reply"; // Default to reply for now
      db.database
        .prepare(
          `
        INSERT OR REPLACE INTO engaged_tweets 
        (tweet_id, engaged_at, action)
        VALUES (?, ?, ?)
      `
        )
        .run(args.mention_id, now, action);

      const executionTime = Date.now() - startTime;

      appLogger.info(
        {
          mention_id: args.mention_id,
          action_taken: args.action_taken,
          previous_status: mention.status,
          execution_time_ms: executionTime,
        },
        "mark_mention_processed: Operation completed successfully"
      );

      logger(
        `Marked mention ${args.mention_id} as processed (${args.action_taken})`
      );

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify({
          mention_id: args.mention_id,
          action_taken: args.action_taken,
          processed_at: now,
          previous_status: mention.status,
        })
      );
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      appLogger.error(
        {
          error: error.message,
          stack: error.stack,
          mention_id: args.mention_id,
          execution_time_ms: executionTime,
        },
        "mark_mention_processed: Unexpected error occurred"
      );

      logger(`Failed to mark mention as processed: ${error.message}`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Unexpected error: ${error.message}`
      );
    }
  },
});

export default markMentionProcessedFunction;
