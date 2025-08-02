// GlitchBot Prompt Loader
//
// This file loads the bot prompt text from docs/glitchbot_prompt.md
// for use in the G.A.M.E agent initialization

import { readFileSync } from "fs";
import { join } from "path";
import logger from "../../../lib/log";

export async function loadGlitchBotPrompt(): Promise<string> {
  try {
    logger.info("Loading GlitchBot prompt...");

    const promptPath = join(process.cwd(), "docs", "glitchbot_prompt.md");
    const promptText = readFileSync(promptPath, "utf-8");

    logger.info("GlitchBot prompt loaded successfully");
    return promptText;
  } catch (error) {
    logger.error({ error }, "Failed to load GlitchBot prompt");
    throw error;
  }
}

export default { loadGlitchBotPrompt };
