import {
  GameAgent,
  GameWorker,
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import dotenv from "dotenv";

dotenv.config();

// Simple function that tells a joke
const tellJokeFunction = new GameFunction({
  name: "tell_joke",
  description: "Tells a joke",
  args: [
    {
      name: "joke",
      description: "The joke to tell",
    },
  ] as const,
  executable: async (args, logger) => {
    try {
      const joke = args.joke;
      if (!joke) {
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "No joke provided"
        );
      }

      console.log(`\n🎪 JOKEBOT: ${joke}\n`);
      logger(`Told joke: ${joke}`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        joke
      );
    } catch (error: any) {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Failed to tell joke: ${error.message}`
      );
    }
  },
});

// Simple function that sings a song
const singSongFunction = new GameFunction({
  name: "sing_song",
  description: "Sings a song",
  args: [
    {
      name: "song_line",
      description: "The song line to sing with rhythm and 🎵",
    },
  ] as const,
  executable: async (args, logger) => {
    try {
      const songLine = args.song_line;
      if (!songLine) {
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "No song line provided"
        );
      }

      console.log(`\n🎵 JOKER SINGS: ${songLine} 🎵\n`);
      logger(`Sang song line: ${songLine}`);

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        songLine
      );
    } catch (error: any) {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Failed to sing song: ${error.message}`
      );
    }
  },
});

// Create a worker that contains the joke function
const jokeWorker = new GameWorker({
  id: "joke_worker",
  name: "Joke Worker",
  description: "Tells jokes",
  functions: [tellJokeFunction],
});

// Create a worker that contains the singing function
const singWorker = new GameWorker({
  id: "sing_worker",
  name: "Sing Worker",
  description: "Sings songs with rhythm",
  functions: [singSongFunction],
});

async function main() {
  console.log("🎭 Starting Joker...");

  const apiKey = process.env.VIRTUALS_API_KEY || process.env.GAME_API_KEY;
  if (!apiKey) {
    console.error(
      "❌ Please set VIRTUALS_API_KEY or GAME_API_KEY in your .env file"
    );
    process.exit(1);
  }

  // Create the agent
  const agent = new GameAgent(apiKey, {
    name: "Joker",
    goal: "Continuously entertain people by telling jokes or singing songs at regular intervals forever",
    description:
      "I am an entertainment bot that lives to make people laugh and sing along. My purpose is to continuously tell jokes and sing songs, switching between both to keep things interesting. I should never consider my job 'done' - there are always more jokes to tell, more songs to sing, and more people to entertain. I operate in an endless cycle of entertainment.",
    workers: [jokeWorker, singWorker],
  });

  // Initialize and start
  await agent.init();
  console.log("✅ Joker initialized! Running continuously...");
  console.log("Press Ctrl+C to stop");

  // Use step method with proper error handling and throttling
  let stepCount = 0;
  while (true) {
    console.log("stepCount:", stepCount); // Before every step!
    stepCount++;
    try {
      await agent.step({ verbose: false });
      await new Promise((r) => setTimeout(r, 60000)); // throttle or heartbeat delay
    } catch (err) {
      console.error("Agent step error:", err);
      await new Promise((r) => setTimeout(r, 60000)); // longer delay on error
    }
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Joker shutting down...");
  process.exit(0);
});

main().catch(console.error);
