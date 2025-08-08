import { GameAgent } from "@virtuals-protocol/game";
import dotenv from "dotenv";
import timelineWorker from "./workers/timeline-worker";

dotenv.config();

/**
 * TimelineAgent: Discovers and analyzes the Twitter home timeline for @glitchbot_ai.
 *
 * This agent fetches the home timeline using the timelineWorker and is designed for future AI-driven tweet selection and quote-tweeting.
 * For now, it only fetches and returns the timeline.
 */
async function main() {
  console.log("🤖 Starting TimelineAgent...");

  const apiKey = process.env.VIRTUALS_API_KEY || process.env.GAME_API_KEY;
  if (!apiKey) {
    console.error(
      "❌ Please set VIRTUALS_API_KEY or GAME_API_KEY in your .env file"
    );
    process.exit(1);
  }

  // Create the agent
  const agent = new GameAgent(apiKey, {
    name: "TimelineAgent",
    goal: "Continuously discover and quote-tweet the most valuable AI, crypto, software, and tech content from the home timeline to share with the @glitchbot_ai community.",
    description: `
      I am TimelineAgent, an AI-powered content curator for @glitchbot_ai. My mission is to discover and share the most valuable technical content with our community of developers, researchers, and tech innovators.

      WORKFLOW STRATEGY:
      1. **Fetch Timeline**: Use get_timeline to get fresh content from tech leaders and industry experts
      2. **Analyze Content**: Evaluate tweets for technical depth, innovation, and relevance to our audience
      3. **Select Best Tweet**: Choose the single most valuable piece of content that advances AI/crypto/software/tech knowledge
      4. **Quote Tweet**: Share it with technical commentary that adds insight and sparks discussion

      SELECTION PRIORITIES (in order):
      - Research findings and technical breakthroughs
      - New product, tool or framework releases and innovations 
      - AI and LLM news and insights
      - Industry insights
      - Market analysis with technical implications
      - Startup launches with technical significance

      HARD EXCLUSIONS:
      - Politics and policy: elections, parties, presidents, congress, social security, immigration.
      - General news and non-tech topics.

      AUDIENCE FOCUS:
      Our community consists of developers, researchers, crypto enthusiasts, and tech innovators. Every piece of content I share must pass the "Would a technical professional find this valuable?" test.

      QUALITY AND QUANTITY:
      - Best case: High-quality technical substance AND strong early engagement (good likes in a short time window).
      - Still good: High-quality technical content with modest engagement (prioritize technical depth, substance, and learning value).
      - Never select: High-virality but low-quality or shallow content.

      COMMENTARY STYLE:
      When quote-tweeting, I add technical insights that demonstrate understanding and encourage discussion among our technical community.

      QUOTING CALL DISCIPLINE:
      When calling quote_tweet, pass:
      - tweet_id: the ID of the selected tweet
      - username: the EXACT author username of that tweet (from includes.users in get_timeline; match user.id == tweet.author_id; no @)
      - comment: your technical commentary

      Never guess the username or substitute with a popular account. If the author username isn't available, skip quoting.
      Example:
      quote_tweet({ tweet_id: "19533...", username: "janedoe", comment: "Great paper on LLM context optimizations…" })
    `,
    workers: [timelineWorker],
  });

  // Initialize and start
  await agent.init();
  console.log("✅ TimelineAgent initialized! Running continuously...");
  console.log("Press Ctrl+C to stop");

  // Get timeout values from environment variables
  const stepInterval = parseInt(process.env.AGENT_STEP_INTERVAL || "180000"); // Default: 3 minutes
  const errorInterval = parseInt(process.env.AGENT_ERROR_INTERVAL || "180000"); // Default: 3 minutes
  const verboseLogging = process.env.AGENT_VERBOSE === "true";

  console.log(`⚙️ Agent configuration:`);
  console.log(`   Step interval: ${stepInterval / 1000}s`);
  console.log(`   Error interval: ${errorInterval / 1000}s`);
  console.log(`   Verbose logging: ${verboseLogging}`);

  // Use step method with proper error handling and throttling
  let stepCount = 0;
  while (true) {
    console.log("--------------------------------");
    console.log("Step #", stepCount);
    stepCount++;
    try {
      await agent.step({ verbose: verboseLogging });
      await new Promise((r) => setTimeout(r, stepInterval));
    } catch (err) {
      console.error("Agent step error:", err);
      await new Promise((r) => setTimeout(r, errorInterval));
    }
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 TimelineAgent shutting down...");
  process.exit(0);
});

main().catch(console.error);
