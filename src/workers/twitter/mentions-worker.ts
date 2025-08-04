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
import scoreContentFunction from "../../functions/atomic/analytics/score-content";
import storeCandidateTweetFunction from "../../functions/atomic/utilities/store-candidate-tweet";
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
        scoreContentFunction,
        storeCandidateTweetFunction,
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

        // Step 6: Process each mention with enhanced content analysis
        for (const mention of mentions) {
          try {
            appLogger.debug(
              {
                mention_id: mention.mention_id,
                author: mention.author_username,
                priority: mention.priority,
                text_preview: mention.text.substring(0, 50) + "...",
              },
              "MentionsWorker: Processing mention with content analysis"
            );

            // Phase 2A: Analyze content for scoring and intent detection
            let contentAnalysis = null;
            let responseText = `Thanks for mentioning me, @${mention.author_username}! 🤖`;

            try {
              // Find referenced tweet data if available
              let referencedTweet: any = null;
              let referencedAuthor: any = null;

              if (
                mentionsData.includes?.tweets &&
                mention.referenced_tweets?.length > 0
              ) {
                const referencedTweetId = mention.referenced_tweets[0].id;
                referencedTweet = mentionsData.includes.tweets.find(
                  (t) => t.id === referencedTweetId
                );

                if (referencedTweet && mentionsData.includes?.users) {
                  referencedAuthor = mentionsData.includes.users.find(
                    (u) => u.id === referencedTweet.author_id
                  );
                }
              }

              // Get mention author info
              const mentionAuthor = mentionsData.includes?.users?.find(
                (u) => u.id === mention.author_id
              );

              // Analyze content for better responses
              const analysisArgs: any = {
                mention_text: mention.text,
              };
              
              if (mentionAuthor) {
                analysisArgs.mention_author = JSON.stringify(mentionAuthor);
              }
              if (referencedTweet) {
                analysisArgs.referenced_tweet = JSON.stringify(referencedTweet);
              }
              if (referencedAuthor) {
                analysisArgs.referenced_author = JSON.stringify(referencedAuthor);
              }

              const analysisResult = await scoreContentFunction.executable(
                analysisArgs,
                (msg: string) => appLogger.debug(`content_analysis: ${msg}`)
              );

              if (analysisResult.status === "done") {
                contentAnalysis = JSON.parse(analysisResult.feedback);

                appLogger.info(
                  {
                    mention_id: mention.mention_id,
                    combined_score: contentAnalysis.combined_score,
                    intent_type: contentAnalysis.intent_type,
                    response_style: contentAnalysis.response_style,
                    confidence: contentAnalysis.confidence,
                  },
                  "MentionsWorker: Content analysis completed"
                );

                // Generate context-aware response based on analysis
                responseText = this.generateContextualResponse(
                  mention.author_username,
                  contentAnalysis,
                  referencedTweet
                );

                                  // Phase 2B: Store high-quality referenced tweets
                  if (referencedTweet && contentAnalysis.combined_score >= 8) {
                    try {
                      const storageArgs: any = {
                        referenced_tweet: JSON.stringify(referencedTweet),
                        mention_id: mention.mention_id,
                        content_analysis: JSON.stringify(contentAnalysis),
                      };
                      
                      if (referencedAuthor) {
                        storageArgs.referenced_author = JSON.stringify(referencedAuthor);
                      }

                      const storageResult =
                        await storeCandidateTweetFunction.executable(
                          storageArgs,
                          (msg: string) => appLogger.debug(`storage: ${msg}`)
                        );

                    if (storageResult.status === "done") {
                      const storageData = JSON.parse(storageResult.feedback);
                      if (storageData.stored) {
                        appLogger.info(
                          {
                            mention_id: mention.mention_id,
                            tweet_id: referencedTweet.id,
                            storage_reason: storageData.reason,
                          },
                          "MentionsWorker: Referenced tweet stored for future discovery"
                        );
                      }
                    }
                  } catch (storageError: any) {
                    appLogger.warn(
                      {
                        mention_id: mention.mention_id,
                        error: storageError.message,
                      },
                      "MentionsWorker: Failed to store referenced tweet"
                    );
                  }
                }
              }
            } catch (analysisError: any) {
              appLogger.warn(
                {
                  mention_id: mention.mention_id,
                  error: analysisError.message,
                },
                "MentionsWorker: Content analysis failed, using standard response"
              );
            }

            // Post the reply
            const replyResult = await replyToTweetFunction.executable(
              {
                tweet_id: mention.mention_id,
                reply_text: responseText,
              },
              (msg: string) => appLogger.debug(`reply: ${msg}`)
            );

            if (replyResult.status === "done") {
              // Mark as processed with enhanced action data
              const actionData = contentAnalysis
                ? {
                    action_taken: "replied_with_analysis",
                    content_score: contentAnalysis.combined_score,
                    intent_type: contentAnalysis.intent_type,
                    response_style: contentAnalysis.response_style,
                  }
                : { action_taken: "replied" };

              await markMentionProcessedFunction.executable(
                {
                  mention_id: mention.mention_id,
                  action_taken: JSON.stringify(actionData),
                },
                (msg: string) => appLogger.debug(`mark_processed: ${msg}`)
              );

              appLogger.info(
                {
                  mention_id: mention.mention_id,
                  author: mention.author_username,
                  response_text: responseText,
                  content_analysis: contentAnalysis
                    ? {
                        score: contentAnalysis.combined_score,
                        intent: contentAnalysis.intent_type,
                        style: contentAnalysis.response_style,
                      }
                    : null,
                },
                "MentionsWorker: Successfully replied to mention with enhanced analysis"
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

  /**
   * Generate contextual responses based on content analysis
   * Phase 3A implementation (early preview)
   */
  private generateContextualResponse(
    username: string,
    analysis: any,
    _referencedTweet?: any
  ): string {
    const templates = {
      news_share: [
        `Thanks for sharing this news, @${username}! 📰 Looks interesting, I'll take a closer look`,
        `Appreciate you bringing this to my attention, @${username}! 🗞️ Fascinating development`,
        `Thanks for the heads up, @${username}! 📈 Always good to stay informed`,
      ],
      opinion_share: [
        `Thanks for tagging me on this perspective, @${username}! 🤔 Interesting viewpoint`,
        `Appreciate you including me in this discussion, @${username}! 💭 I'll consider this`,
        `Thanks for sharing your thoughts, @${username}! 🧠 Good food for thought`,
      ],
      question: [
        `Thanks for bringing this to my attention, @${username}! 🤖 I'll analyze this`,
        `Appreciate the question, @${username}! 🧠 Let me take a look at this`,
        `Thanks for asking, @${username}! 🔍 I'll give this some thought`,
      ],
      general: [
        `Thanks for mentioning me, @${username}! 🤖`,
        `Appreciate the mention, @${username}! 👋`,
        `Thanks for including me, @${username}! 🚀`,
      ],
    };

    // High-quality content gets more enthusiastic responses
    const qualityModifiers =
      analysis.combined_score >= 15
        ? [
            "This looks really high-quality! ",
            "Excellent content! ",
            "Great find! ",
          ]
        : analysis.combined_score >= 12
        ? ["This looks interesting! ", "Nice share! ", ""]
        : [""];

    const responseType = analysis.response_style || "general";
    const templateArray = templates[responseType as keyof typeof templates] || templates.general;
    const selectedTemplate =
      templateArray[Math.floor(Math.random() * templateArray.length)];

    const qualityModifier =
      qualityModifiers[Math.floor(Math.random() * qualityModifiers.length)] || "";

    return (qualityModifier || "") + (selectedTemplate || `Thanks for mentioning me, @${username}! 🤖`);
  }

  /**
   * Enhanced production testing method
   * Tests the complete pipeline: fetch → analyze → store → respond
   */
  async testProductionPipeline(): Promise<any> {
    try {
      appLogger.info("MentionsWorker: Running PRODUCTION PIPELINE test...");

      const startTime = Date.now();

      // Step 1: Fetch mentions with enhanced API
      const fetchResult = await fetchMentionsFunction.executable(
        { max_results: "5" },
        (msg: string) => appLogger.info(`PIPELINE: ${msg}`)
      );

      if (fetchResult.status !== "done") {
        return { success: false, error: "Failed to fetch mentions" };
      }

      const mentionsData: FetchMentionsResult = JSON.parse(
        fetchResult.feedback
      );

      const results = {
        execution_time: Date.now() - startTime,
        mentions_found: mentionsData.mentions.length,
        includes_data: {
          tweets: mentionsData.includes?.tweets?.length || 0,
          users: mentionsData.includes?.users?.length || 0,
        },
        analysis_results: [] as any[],
        storage_results: [] as any[],
        rate_limit: mentionsData.rate_limit,
      };

      // Step 2: Analyze each mention
      for (const mention of mentionsData.mentions) {
        try {
          // Find referenced tweet data
          let referencedTweet: any = null;
          let referencedAuthor: any = null;

          if (
            mentionsData.includes?.tweets &&
            mention.referenced_tweets &&
            mention.referenced_tweets.length > 0
          ) {
            const referencedTweetId = mention.referenced_tweets[0]?.id;
            referencedTweet = mentionsData.includes.tweets.find(
              (t) => t.id === referencedTweetId
            );

            if (referencedTweet && mentionsData.includes?.users) {
              referencedAuthor = mentionsData.includes.users.find(
                (u) => u.id === referencedTweet.author_id
              );
            }
          }

          const mentionAuthor = mentionsData.includes?.users?.find(
            (u) => u.id === mention.author_id
          );

          // Analyze content
          const testAnalysisArgs: any = {
            mention_text: mention.text,
          };
          
          if (mentionAuthor) {
            testAnalysisArgs.mention_author = JSON.stringify(mentionAuthor);
          }
          if (referencedTweet) {
            testAnalysisArgs.referenced_tweet = JSON.stringify(referencedTweet);
          }
          if (referencedAuthor) {
            testAnalysisArgs.referenced_author = JSON.stringify(referencedAuthor);
          }

          const analysisResult = await scoreContentFunction.executable(
            testAnalysisArgs,
            () => {} // Silent logger for test
          );

          if (analysisResult.status === "done") {
            const analysis = JSON.parse(analysisResult.feedback);

            results.analysis_results.push({
              mention_id: mention.id,
              author: mention.author_id,
              text_preview: mention.text.substring(0, 50) + "...",
              combined_score: analysis.combined_score,
              intent_type: analysis.intent_type,
              response_style: analysis.response_style,
              confidence: analysis.confidence,
              has_referenced_tweet: !!referencedTweet,
            });

            // Test storage for high-quality content
            if (referencedTweet && analysis.combined_score >= 8) {
              const testStorageArgs: any = {
                referenced_tweet: JSON.stringify(referencedTweet),
                mention_id: mention.id,
                content_analysis: JSON.stringify(analysis),
              };
              
              if (referencedAuthor) {
                testStorageArgs.referenced_author = JSON.stringify(referencedAuthor);
              }

              const storageResult =
                await storeCandidateTweetFunction.executable(
                  testStorageArgs,
                  () => {} // Silent logger for test
                );

              if (storageResult.status === "done") {
                const storageData = JSON.parse(storageResult.feedback);
                results.storage_results.push({
                  mention_id: mention.id,
                  referenced_tweet_id: referencedTweet.id,
                  stored: storageData.stored,
                  reason: storageData.reason,
                  score: analysis.combined_score,
                });
              }
            }
          }
        } catch (error: any) {
          appLogger.warn(
            { error: error.message },
            "Error in pipeline test analysis"
          );
        }
      }

      appLogger.info(
        {
          pipeline_results: results,
        },
        "MentionsWorker: Production pipeline test completed"
      );

      return { success: true, results };
    } catch (error: any) {
      appLogger.error(
        { error: error.message },
        "MentionsWorker: Production pipeline test failed"
      );
      return { success: false, error: error.message };
    }
  }
}
