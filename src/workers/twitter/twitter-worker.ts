// Level 2: GameWorker (Low-Level Planner)
//
// The TwitterWorker specializes in Twitter operations and coordinates
// GameFunctions to accomplish specific social media engagement tasks.
//
// Responsibilities:
// - Plan HOW to achieve delegated tasks from GameAgent
// - Sequence GameFunctions for optimal execution
// - Handle Twitter-specific domain logic and constraints
// - Manage state between function calls

import { GameWorker } from "@virtuals-protocol/game";
import logger from "../../lib/log";
import GlitchBotDB from "../../lib/db";

// TODO: Future implementation - add Level 3 GameFunctions imports
// These will be added as each function is implemented and tested:
// - fetchMentionsFunction ✅ (implemented)
// - searchTweetsFunction
// - fetchTimelineFunction
// - replyToTweetFunction
// - quoteTweetFunction
// - likeTweetFunction
// - sendDMFunction
// - scoreTweetFunction
// - checkCadenceFunction

export class TwitterWorkerManager {
  private worker: GameWorker | null = null;

  constructor(_db: GlitchBotDB) {
    // Database will be used when GameFunctions are implemented
  }

  initialize(): GameWorker {
    logger.info("Initializing TwitterWorker...");

    this.worker = new GameWorker({
      id: "twitter_worker",
      name: "Twitter Operations Specialist",
      description:
        "Handles all Twitter API interactions and engagement strategies for GlitchBot",
      functions: [
        // TODO: Add GameFunctions when implementation is ready
        // Discovery Functions - Level 3
        // fetchMentionsFunction,
        // searchTweetsFunction,
        // fetchTimelineFunction,
        // Engagement Functions - Level 3
        // replyToTweetFunction,
        // quoteTweetFunction,
        // likeTweetFunction,
        // Utility Functions - Level 3
        // sendDMFunction,
        // scoreTweetFunction,
        // checkCadenceFunction
      ],

      // Environment context for the G.A.M.E framework
      getEnvironment: async () => ({
        platform: "Twitter/X",
        capabilities:
          "mention_replies, quote_tweets, likes, DMs, timeline_analysis",
        constraints:
          "2h quote cadence, 1min reply cadence, sleep 02:00-10:00 UTC-3",
        focus_topics: "crypto, AI, tech, startups, DeFi, machine learning",
        content_style:
          "friendly, techy, slightly dark, no hashtags, max 1 emoji",
        behavior_rules:
          "no original tweets, no follows, no deletions, authentic engagement only",
      }),
    });

    logger.info("✅ TwitterWorker initialized with all GameFunctions");
    return this.worker;
  }

  getWorker(): GameWorker {
    if (!this.worker) {
      throw new Error(
        "TwitterWorker not initialized. Call initialize() first."
      );
    }
    return this.worker;
  }
}

// Export singleton instance
export const twitterWorker = new TwitterWorkerManager(
  new GlitchBotDB() // TODO: Pass this from dependency injection
).initialize();

export default twitterWorker;
