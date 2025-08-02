// Level 1: GameAgent (High-Level Planner)
//
// The GlitchBot GameAgent makes strategic decisions about:
// - What tasks to prioritize (mentions vs discovery vs engagement)
// - When to be active (sleep schedule management)
// - Overall goal achievement and learning from outcomes
//
// This is the top-level orchestrator that delegates to specialized workers.

import { GameAgent } from "@virtuals-protocol/game";
import logger from "../../lib/log";
// TODO: Import and use specialized workers when implementing logic
// import { TwitterWorkerManager } from "../../workers/twitter/twitter-worker";
import { loadGlitchBotPrompt } from "./config/prompts";

export class GlitchBotAgent {
  private agent: GameAgent | null = null;

  async initialize(): Promise<void> {
    logger.info("Initializing GlitchBot GameAgent...");

    try {
      // Load bot personality and instructions
      const prompt = await loadGlitchBotPrompt();

      // Create the G.A.M.E agent
      const apiKey = process.env.VIRTUALS_API_KEY || "";
      this.agent = new GameAgent(apiKey, {
        name: "GlitchBot",
        goal: "Engage authentically with the crypto/AI/tech community on Twitter",
        description: prompt,
        workers: [], // TODO: Initialize specialized workers from new architecture
      });

      // Initialize the agent
      await this.agent.init();

      logger.info("✅ GlitchBot GameAgent initialized successfully");
    } catch (error) {
      logger.error({ error }, "Failed to initialize GlitchBot GameAgent");
      throw error;
    }
  }

  async start(intervalSeconds: number = 60): Promise<void> {
    if (!this.agent) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    logger.info({ intervalSeconds }, "Starting GlitchBot agent execution loop");

    // Start the main agent loop
    await this.agent.run(intervalSeconds, { verbose: true });
  }

  async stop(): Promise<void> {
    if (this.agent) {
      logger.info("Stopping GlitchBot agent...");
      // TODO: Implement proper shutdown when available in G.A.M.E framework
      this.agent = null;
    }
  }
}

// Factory function for easy instantiation
export async function createGlitchBotAgent(): Promise<GlitchBotAgent> {
  const agent = new GlitchBotAgent();
  await agent.initialize();
  return agent;
}

export default GlitchBotAgent;
