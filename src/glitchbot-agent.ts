import { GameAgent } from "@virtuals-protocol/game";
import dotenv from "dotenv";
import mentionsWorker from "./workers/mentions-worker";

dotenv.config();

async function main() {
  console.log("🤖 Starting GlitchBot...");

  const apiKey = process.env.VIRTUALS_API_KEY || process.env.GAME_API_KEY;
  if (!apiKey) {
    console.error(
      "❌ Please set VIRTUALS_API_KEY or GAME_API_KEY in your .env file"
    );
    process.exit(1);
  }

  // Create the agent
  const agent = new GameAgent(apiKey, {
    name: "GlitchBot",
    goal: "Engage authentically with the crypto/AI/tech community by responding to mentions and acknowledging content shares",
    description:
      "I am GlitchBot, an AI assistant that helps the crypto/AI/tech community by responding to mentions and acknowledging when users share interesting content with me. My primary role is to thank users for tagging me with interesting tweets, articles, projects, and discoveries. I maintain a helpful, technical but friendly voice while building genuine relationships with community members who act as content scouts and curators. I process mentions intelligently, acknowledge shares gracefully, and provide value in every interaction.",
    workers: [mentionsWorker],
  });

  // Initialize and start
  await agent.init();
  console.log("✅ GlitchBot initialized! Running continuously...");
  console.log("Press Ctrl+C to stop");

  // Get timeout values from environment variables
  const stepInterval = parseInt(process.env.AGENT_STEP_INTERVAL || "180000"); // Default: 3 minutes
  const errorInterval = parseInt(process.env.AGENT_ERROR_INTERVAL || "180000"); // Default: 3 minutes
  const verboseLogging = process.env.AGENT_VERBOSE === "true"; // Default: false

  console.log(`⚙️ Agent configuration:`);
  console.log(`   Step interval: ${stepInterval / 1000}s`);
  console.log(`   Error interval: ${errorInterval / 1000}s`);
  console.log(`   Verbose logging: ${verboseLogging}`);

  // Use step method with proper error handling and throttling
  let stepCount = 0;
  while (true) {
    console.log("--------------------------------");
    console.log("Step #", stepCount); // Before every step!
    stepCount++;
    try {
      await agent.step({ verbose: verboseLogging });
      await new Promise((r) => setTimeout(r, stepInterval)); // configurable delay
    } catch (err) {
      console.error("Agent step error:", err);
      await new Promise((r) => setTimeout(r, errorInterval)); // configurable error delay
    }
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 GlitchBot shutting down...");
  process.exit(0);
});

main().catch(console.error);
