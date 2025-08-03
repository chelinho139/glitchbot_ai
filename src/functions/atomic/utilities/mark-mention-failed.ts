import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import GlitchBotDB from "../../../lib/db";
import appLogger from "../../../lib/log";

export const markMentionFailedFunction = new GameFunction({
  name: "mark_mention_failed",
  description:
    "Mark mention as failed, increment retry count, and return to pending status for retry",
  args: [
    {
      name: "mention_id",
      description: "ID of the mention that failed to process",
    },
    {
      name: "error_message",
      description: "Detailed error message from the failure",
    },
    {
      name: "max_retries",
      description:
        "Maximum retry attempts before marking as permanently failed (default: 3)",
    },
  ] as const,
  executable: async (args, logger) => {
    const startTime = Date.now();

    try {
      logger("Marking mention as failed and preparing for retry");
      appLogger.info(
        {
          mention_id: args.mention_id,
          error_message: args.error_message,
          max_retries: args.max_retries,
        },
        "mark_mention_failed: Starting operation"
      );

      if (!args.mention_id || !args.error_message) {
        appLogger.error("mark_mention_failed: Missing required parameters");
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "mention_id and error_message are required"
        );
      }

      const db = new GlitchBotDB();
      const maxRetries = parseInt(args.max_retries || "3");

      // Get current mention state
      const currentMention = db.database
        .prepare(
          "SELECT retry_count, status FROM pending_mentions WHERE mention_id = ?"
        )
        .get(args.mention_id) as { retry_count: number; status: string } | null;

      if (!currentMention) {
        appLogger.warn(
          { mention_id: args.mention_id },
          "mark_mention_failed: Mention not found in database"
        );
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "Mention not found in database"
        );
      }

      const newRetryCount = currentMention.retry_count + 1;
      const now = new Date().toISOString();

      if (newRetryCount >= maxRetries) {
        // Max retries reached - mark as permanently failed
        db.database
          .prepare(
            `
            UPDATE pending_mentions 
            SET status = 'failed', 
                retry_count = ?,
                last_error = ?,
                worker_id = NULL,
                processed_at = ?
            WHERE mention_id = ?
          `
          )
          .run(newRetryCount, args.error_message, now, args.mention_id);

        appLogger.warn(
          {
            mention_id: args.mention_id,
            retry_count: newRetryCount,
            max_retries: maxRetries,
          },
          "mark_mention_failed: Max retries reached, marking as permanently failed"
        );

        logger(
          `Mention marked as permanently failed after ${newRetryCount} attempts`
        );
      } else {
        // Return to pending for retry
        db.database
          .prepare(
            `
            UPDATE pending_mentions 
            SET status = 'pending', 
                retry_count = ?,
                last_error = ?,
                worker_id = NULL
            WHERE mention_id = ?
          `
          )
          .run(newRetryCount, args.error_message, args.mention_id);

        appLogger.info(
          {
            mention_id: args.mention_id,
            retry_count: newRetryCount,
            max_retries: maxRetries,
            previous_status: currentMention.status,
          },
          "mark_mention_failed: Returned to pending for retry"
        );

        logger(
          `Mention returned to pending (retry ${newRetryCount}/${maxRetries})`
        );
      }

      const executionTime = Date.now() - startTime;

      appLogger.info(
        {
          mention_id: args.mention_id,
          new_retry_count: newRetryCount,
          final_status: newRetryCount >= maxRetries ? "failed" : "pending",
          execution_time_ms: executionTime,
        },
        "mark_mention_failed: Operation completed successfully"
      );

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify({
          mention_id: args.mention_id,
          retry_count: newRetryCount,
          status: newRetryCount >= maxRetries ? "failed" : "pending",
          will_retry: newRetryCount < maxRetries,
          execution_time_ms: executionTime,
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
        "mark_mention_failed: Unexpected error occurred"
      );

      logger(`Failed to mark mention as failed: ${error.message}`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Unexpected error: ${error.message}`
      );
    }
  },
});

export default markMentionFailedFunction;
