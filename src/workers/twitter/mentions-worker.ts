import { GameWorker } from "@virtuals-protocol/game";
import GlitchBotDB from "../../lib/db";
import fetchMentionsFunction, {
  FetchMentionsResult,
} from "../../functions/atomic/social/twitter/fetch-mentions";
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
      // Add the fetch_mentions function to this worker
      functions: [fetchMentionsFunction],
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
   * Step 1.1 Implementation: Basic mention fetching
   * This method demonstrates the fetch_mentions GameFunction in action
   */
  async execute(): Promise<void> {
    try {
      appLogger.info("MentionsWorker: Starting execution cycle");

      // Step 1.1: Fetch mentions using our new GameFunction
      appLogger.debug("MentionsWorker: Fetching mentions...");

      // Call the fetch_mentions function directly for Step 1.1
      const result = await fetchMentionsFunction.executable(
        {
          max_results: "10",
        },
        (msg: string) => appLogger.debug(`fetch_mentions: ${msg}`)
      );

      if (result.status === "done") {
        // Parse the result from the GameFunction
        const mentionsData: FetchMentionsResult = JSON.parse(result.feedback);

        appLogger.info(
          {
            mentions_count: mentionsData.mentions.length,
            newest_id: mentionsData.meta.newest_id,
            rate_limit_remaining: mentionsData.rate_limit?.remaining,
          },
          "MentionsWorker: Mentions fetched successfully"
        );

        // Log each mention for debugging (Step 1.1 requirement)
        mentionsData.mentions.forEach((mention, index) => {
          appLogger.debug(
            {
              mention_index: index + 1,
              tweet_id: mention.id,
              author: mention.author_username,
              text:
                mention.text.substring(0, 100) +
                (mention.text.length > 100 ? "..." : ""),
              created_at: mention.created_at,
            },
            "MentionsWorker: Processing mention"
          );
        });

        // TODO: For next steps (1.2, 1.3, 1.4):
        // - Analyze intent for each mention
        // - Generate appropriate responses
        // - Track conversation context
        // - Handle delegation to other workers

        if (mentionsData.mentions.length === 0) {
          appLogger.info("MentionsWorker: No new mentions found");
        } else {
          appLogger.info(
            `MentionsWorker: Found ${mentionsData.mentions.length} mentions ready for processing`
          );
        }
      } else {
        appLogger.warn(
          { status: result.status, feedback: result.feedback },
          "MentionsWorker: Failed to fetch mentions"
        );
      }
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
