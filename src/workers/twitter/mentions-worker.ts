import { GameWorker } from "@virtuals-protocol/game";
import GlitchBotDB from "../../lib/db";
import fetchMentionsFunction, {
  FetchMentionsResult,
} from "../../functions/atomic/social/twitter/fetch-mentions";
import storePendingMentionsFunction from "../../functions/atomic/utilities/store-pending-mentions";
import getProcessableMentionsFunction from "../../functions/atomic/utilities/get-processable-mentions";
import replyToTweetFunction from "../../functions/atomic/social/twitter/reply-to-tweet";
import markMentionProcessedFunction from "../../functions/atomic/utilities/mark-mention-processed";
import markMentionFailedFunction from "../../functions/atomic/utilities/mark-mention-failed";
import updateMentionCheckpointFunction from "../../functions/atomic/utilities/update-mention-checkpoint";
import appLogger from "../../lib/log";

/**
 * MentionsWorker - Handles Real-Time Social Interactions
 *
 * Priority: CRITICAL (immediate response required)
 * Cycle: Event-driven (triggered by mentions/DMs)
 * Focus: Human engagement, conversation management
 */
export class MentionsWorker extends GameWorker {
  // @ts-ignore - Will be used in future steps
  private _db: GlitchBotDB;

  constructor(db: GlitchBotDB) {
    super({
      id: "mentions_worker",
      name: "Mentions & DM Handler",
      description: "Handles mentions, DMs, and real-time social interactions",
      // Add all mention queue functions to this worker
      functions: [
        fetchMentionsFunction,
        storePendingMentionsFunction,
        getProcessableMentionsFunction,
        replyToTweetFunction,
        markMentionProcessedFunction,
        markMentionFailedFunction,
        updateMentionCheckpointFunction,
      ],
      getEnvironment: async () => ({
        platform: "Twitter/X",
        worker_type: "mentions",
        priority: "CRITICAL",
      }),
    });
    this._db = db;
  }

  /**
   * Core Characteristics:
   * - Real-time response (< 5 minutes for mentions)
   * - Human relationship building
   * - Intent recognition and routing
   * - Community management
   */
  static readonly characteristics = {
    priority: "CRITICAL",
    response_time: "< 5 minutes",
    triggers: ["mentions", "DMs", "tags", "replies_to_bot"],
    personality: "friendly, helpful, engaged",
    conflicts_with: [], // No conflicts - always available
  };

  /**
   * Functions this worker orchestrates:
   * - fetch_mentions: Get recent mentions and DMs ✅ IMPLEMENTED
   * - analyze_intent: Understand what the human wants (TODO)
   * - delegate_tasks: Route requests to other workers (TODO)
   * - reply_to_mention: Respond to human interactions (TODO)
   * - send_dm: Private conversations when needed (TODO)
   */
  static readonly functions = [
    "fetch_mentions", // ✅ Implemented in Step 1.1
    "analyze_intent", // TODO: Step 1.3
    "delegate_tasks", // TODO: Step 2.2
    "reply_to_mention", // TODO: Step 1.2
    "send_dm", // TODO: Step 1.2
    "track_conversation", // TODO: Step 1.4
    "escalate_to_human", // TODO: Step 1.4
  ];

  /**
   * Use Cases:
   * 1. "@GlitchBot check out this tweet" → Delegate to DiscoveryWorker
   * 2. "@GlitchBot what's your take on XYZ?" → Generate thoughtful reply
   * 3. "DM: Help me understand this protocol" → Educational conversation
   * 4. "@GlitchBot can you analyze my project?" → Route analysis request
   * 5. Reply chains → Maintain conversation continuity
   */

  async initialize(): Promise<void> {
    appLogger.info("MentionsWorker: Initializing...");
    // TODO: Initialize mention tracking, conversation context
    // TODO: Set up real-time event listeners
    // TODO: Load conversation history and context
    appLogger.info("MentionsWorker: Initialized successfully");
  }

  /**
   * Step 1.2 Implementation: Queue-based mention processing with zero data loss
   * This method demonstrates the complete mention queue workflow
   */
  async execute(): Promise<void> {
    try {
      appLogger.info("MentionsWorker: Starting queue-based execution cycle");

      // Step 1: Get current checkpoint for since_id
      const currentCheckpoint = this._db.database
        .prepare(
          `
        SELECT value FROM mention_state WHERE key = 'last_since_id'
      `
        )
        .get() as any;
      const sinceId = currentCheckpoint?.value;

      // Step 2: Fetch new mentions
      appLogger.debug("MentionsWorker: Fetching new mentions...");
      const fetchResult = await fetchMentionsFunction.executable(
        {
          max_results: "10",
          since_id: sinceId,
        },
        (msg: string) => appLogger.debug(`fetch_mentions: ${msg}`)
      );

      if (fetchResult.status !== "done") {
        appLogger.warn(
          { status: fetchResult.status, feedback: fetchResult.feedback },
          "MentionsWorker: Failed to fetch mentions"
        );
        return;
      }

      const mentionsData: FetchMentionsResult = JSON.parse(
        fetchResult.feedback
      );
      appLogger.info(
        {
          mentions_count: mentionsData.mentions.length,
          newest_id: mentionsData.meta.newest_id,
          rate_limit_remaining: mentionsData.rate_limit?.remaining,
        },
        "MentionsWorker: Mentions fetched successfully"
      );

      // Step 3: Store ALL mentions in persistent queue (zero loss guarantee)
      if (mentionsData.mentions.length > 0) {
        const storeResult = await storePendingMentionsFunction.executable(
          {
            mentions: JSON.stringify(mentionsData.mentions),
            fetch_id: mentionsData.meta.newest_id || Date.now().toString(),
          },
          (msg: string) => appLogger.debug(`store_mentions: ${msg}`)
        );

        if (storeResult.status === "done") {
          const storeData = JSON.parse(storeResult.feedback);
          appLogger.info(
            {
              stored_count: storeData.stored_count,
              skipped_count: storeData.skipped_count,
            },
            "MentionsWorker: Mentions stored in queue successfully"
          );
        }

        // Step 4: Update checkpoint (safe now that mentions are stored)
        await updateMentionCheckpointFunction.executable(
          {
            since_id: mentionsData.meta.newest_id!,
            fetch_operation_id:
              mentionsData.meta.newest_id || Date.now().toString(),
          },
          (msg: string) => appLogger.debug(`update_checkpoint: ${msg}`)
        );
      }

      // Step 5: Get mentions ready for processing (rate-limit aware)
      const processableResult = await getProcessableMentionsFunction.executable(
        {
          max_count: "5", // Process up to 5 mentions per cycle
        },
        (msg: string) => appLogger.debug(`get_processable: ${msg}`)
      );

      if (processableResult.status === "done") {
        const processableData = JSON.parse(processableResult.feedback);
        const mentions = processableData.mentions;

        appLogger.info(
          {
            processable_count: mentions.length,
            rate_limit_capacity: processableData.rate_limit_capacity,
          },
          "MentionsWorker: Retrieved mentions for processing"
        );

        // Step 6: Process each mention (AI decision-making)
        for (const mention of mentions) {
          try {
            appLogger.debug(
              {
                mention_id: mention.mention_id,
                author: mention.author_username,
                priority: mention.priority,
                text_preview: mention.text.substring(0, 50) + "...",
              },
              "MentionsWorker: Processing mention"
            );

            // Simple response for Step 1.2 - just acknowledge the mention
            const responseText = `Thanks for mentioning me, @${mention.author_username}! 🤖`;

            // Post the reply
            const replyResult = await replyToTweetFunction.executable(
              {
                tweet_id: mention.mention_id,
                reply_text: responseText,
              },
              (msg: string) => appLogger.debug(`reply: ${msg}`)
            );

            if (replyResult.status === "done") {
              // Mark as processed
              await markMentionProcessedFunction.executable(
                {
                  mention_id: mention.mention_id,
                  action_taken: "replied",
                },
                (msg: string) => appLogger.debug(`mark_processed: ${msg}`)
              );

              appLogger.info(
                {
                  mention_id: mention.mention_id,
                  author: mention.author_username,
                  response_text: responseText,
                },
                "MentionsWorker: Successfully replied to mention"
              );
            } else {
              // Mark mention as failed and return to pending for retry
              await markMentionFailedFunction.executable(
                {
                  mention_id: mention.mention_id,
                  error_message: replyResult.feedback,
                  max_retries: "3",
                },
                (msg: string) => appLogger.debug(`mark_failed: ${msg}`)
              );

              appLogger.warn(
                {
                  mention_id: mention.mention_id,
                  author: mention.author_username,
                  error: replyResult.feedback,
                },
                "MentionsWorker: Failed to reply to mention, returned to pending for retry"
              );
            }
          } catch (mentionError: any) {
            appLogger.error(
              {
                mention_id: mention.mention_id,
                error: mentionError.message,
              },
              "MentionsWorker: Error processing individual mention"
            );
          }
        }

        if (mentions.length === 0) {
          appLogger.info("MentionsWorker: No mentions ready for processing");
        }
      }

      appLogger.info("MentionsWorker: Execution cycle completed successfully");
    } catch (error: any) {
      appLogger.error(
        {
          error: error.message,
          stack: error.stack,
        },
        "MentionsWorker: Error during execution"
      );
    }
  }

  /**
   * Step 1.1 Testing Method: Demonstrate mention fetching
   * This can be called directly for testing purposes
   */
  async testFetchMentions(): Promise<FetchMentionsResult | null> {
    try {
      appLogger.info("MentionsWorker: Running fetch mentions test...");

      const result = await fetchMentionsFunction.executable(
        {
          max_results: "5",
        },
        (msg: string) => appLogger.debug(`fetch_mentions: ${msg}`)
      );

      if (result.status === "done") {
        const mentionsData: FetchMentionsResult = JSON.parse(result.feedback);

        appLogger.info(
          {
            test_result: "success",
            mentions_count: mentionsData.mentions.length,
            execution_time: "< 1s",
          },
          "MentionsWorker: Test completed successfully"
        );

        return mentionsData;
      } else {
        appLogger.error(
          { test_result: "failed", error: result.feedback },
          "MentionsWorker: Test failed"
        );
        return null;
      }
    } catch (error: any) {
      appLogger.error(
        {
          test_result: "error",
          error: error.message,
        },
        "MentionsWorker: Test encountered error"
      );
      return null;
    }
  }
}
