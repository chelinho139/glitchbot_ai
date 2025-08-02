import dotenv from "dotenv";
import logger from "./lib/log";
import GlitchBotDB from "./lib/db";
import { isSleepTime } from "./lib/cadence";

// Load environment variables
dotenv.config();

async function main() {
  logger.info("🤖 GlitchBot starting up...");

  // Initialize database
  const db = new GlitchBotDB(process.env.DATABASE_PATH || "./glitchbot.db");

  // Check required environment variables
  const requiredEnvVars = ["VIRTUALS_API_KEY"];
  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingVars.length > 0) {
    logger.error({ missingVars }, "Missing required environment variables");
    process.exit(1);
  }

  // Check Twitter auth method
  const hasGameToken = !!process.env.GAME_TWITTER_TOKEN;
  const hasAppKeys = !!(
    process.env.TWITTER_APP_KEY &&
    process.env.TWITTER_APP_SECRET &&
    process.env.TWITTER_ACCESS_TOKEN &&
    process.env.TWITTER_ACCESS_SECRET
  );

  if (!hasGameToken && !hasAppKeys) {
    logger.error(
      "No Twitter authentication method configured. Set either GAME_TWITTER_TOKEN or Twitter app keys."
    );
    process.exit(1);
  }

  // Check if we're in sleep time
  if (isSleepTime()) {
    logger.info(
      "Currently in sleep window (05:00-13:00 UTC). GlitchBot will start when the sleep window ends."
    );
  }

  logger.info(
    {
      authMethod: hasGameToken ? "game-token" : "app-keys",
      dbPath: process.env.DATABASE_PATH || "./glitchbot.db",
      logLevel: process.env.LOG_LEVEL || "info",
      ownerHandle: process.env.OWNER_HANDLE || "lemoncheli",
    },
    "GlitchBot configuration loaded"
  );

  // Check if Virtuals packages are available and initialize agent
  try {
    require("@virtuals-protocol/game");
    require("@virtuals-protocol/game-twitter-node");
    logger.info("✅ Virtuals G.A.M.E packages are installed and ready!");

    // TODO: Initialize GlitchBot agent when ready
    // const { createGlitchBotAgent } = require('./agents/glitchbot/agent');
    // const agent = await createGlitchBotAgent();
    // await agent.start(60);
  } catch (error) {
    logger.warn(
      "⚠️  Virtuals G.A.M.E packages not found. Please install them first."
    );
  }

  logger.info("🚀 3-Level G.A.M.E Architecture Ready:");
  logger.info("");
  logger.info("📋 Level 1 - GameAgent (High-Level Planner):");
  logger.info("  ✅ GlitchBotAgent - Strategic decision making");
  logger.info("");
  logger.info("⚡ Level 2 - GameWorkers (Specialized Task Execution):");
  logger.info("  ✅ MentionsWorker - Real-time social interactions (CRITICAL)");
  logger.info(
    "  ✅ EngagementWorker - Content creation & strategic posts (HIGH)"
  );
  logger.info("  ✅ DiscoveryWorker - Content discovery & curation (MEDIUM)");
  logger.info("  ✅ MonitoringWorker - System health & performance (LOW)");
  logger.info("  ✅ MaintenanceWorker - Database cleanup & optimization (LOW)");
  logger.info("  ✅ CoordinationWorker - Cross-worker communication (MEDIUM)");
  logger.info("");
  logger.info("🔧 Level 3 - GameFunctions (Atomic Actions):");
  logger.info(
    "  ✅ Twitter Functions - API interactions (fetch, post, search)"
  );
  logger.info("  ✅ Analytics Functions - Content scoring & analysis");
  logger.info("  ✅ Utility Functions - Cadence checking, validation");
  logger.info("  ✅ Workflow Functions - Multi-step processes");
  logger.info("");
  logger.info("🔗 Global Coordination Layer:");
  logger.info("  ✅ EngagementTracker - Prevent duplicate engagement");
  logger.info("  ✅ ReservationManager - Shared resource coordination");
  logger.info("  ✅ RateLimiter - API usage optimization");
  logger.info("");
  logger.info("🔜 Next Implementation Phase:");
  logger.info("  - Implement GameFunction logic with Twitter API");
  logger.info("  - Connect workers to coordination layer");
  logger.info("  - Add real-time worker orchestration");
  logger.info("  - Enable cross-worker task delegation");

  // Graceful shutdown
  process.on("SIGINT", () => {
    logger.info("Received SIGINT, shutting down gracefully...");
    db.close();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM, shutting down gracefully...");
    db.close();
    process.exit(0);
  });

  // Keep the process alive for now
  logger.info(
    "🚀 GlitchBot foundation is ready! Waiting for full implementation..."
  );
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled rejection");
  process.exit(1);
});

// Start the application
main().catch((error) => {
  logger.error({ error }, "Failed to start GlitchBot");
  process.exit(1);
});
