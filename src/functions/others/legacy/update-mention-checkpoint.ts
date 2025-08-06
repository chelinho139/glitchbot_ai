import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import GlitchBotDB from "../../../lib/db";
import appLogger from "../../../lib/log";

export const updateMentionCheckpointFunction = new GameFunction({
  name: "update_mention_checkpoint",
  description:
    "Update the since_id checkpoint for mention fetching to track progress",
  args: [
    {
      name: "since_id",
      description: "The newest mention ID to set as checkpoint",
    },
    {
      name: "fetch_operation_id",
      description: "Optional: ID of the fetch operation for tracking",
    },
  ] as const,
  executable: async (args, logger) => {
    const startTime = Date.now();

    try {
      logger("Updating mention checkpoint");
      appLogger.info(
        {
          since_id: args.since_id,
          fetch_operation_id: args.fetch_operation_id,
        },
        "update_mention_checkpoint: Starting operation"
      );

      if (!args.since_id) {
        appLogger.error("update_mention_checkpoint: since_id is required");
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "since_id is required"
        );
      }

      const db = new GlitchBotDB();
      const now = new Date().toISOString();

      // Get current checkpoint for comparison
      const currentCheckpoint = db.database
        .prepare(
          `
        SELECT value FROM mention_state WHERE key = 'last_since_id'
      `
        )
        .get() as any;

      const previousSinceId = currentCheckpoint?.value || "none";

      // Update the checkpoint
      db.database
        .prepare(
          `
        INSERT OR REPLACE INTO mention_state 
        (key, value, updated_at)
        VALUES ('last_since_id', ?, ?)
      `
        )
        .run(args.since_id, now);

      // Also update last fetch time
      db.database
        .prepare(
          `
        INSERT OR REPLACE INTO mention_state 
        (key, value, updated_at)
        VALUES ('last_fetch_time', ?, ?)
      `
        )
        .run(now, now);

      const executionTime = Date.now() - startTime;

      appLogger.info(
        {
          previous_since_id: previousSinceId,
          new_since_id: args.since_id,
          updated_at: now,
          execution_time_ms: executionTime,
        },
        "update_mention_checkpoint: Checkpoint updated successfully"
      );

      logger(
        `Updated mention checkpoint from ${previousSinceId} to ${args.since_id}`
      );

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify({
          previous_since_id: previousSinceId,
          new_since_id: args.since_id,
          updated_at: now,
        })
      );
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      appLogger.error(
        {
          error: error.message,
          stack: error.stack,
          since_id: args.since_id,
          execution_time_ms: executionTime,
        },
        "update_mention_checkpoint: Unexpected error occurred"
      );

      logger(`Failed to update mention checkpoint: ${error.message}`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Unexpected error: ${error.message}`
      );
    }
  },
});

export default updateMentionCheckpointFunction;
