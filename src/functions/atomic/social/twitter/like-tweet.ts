// Level 3: GameFunction - Like Tweet
import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";

export const likeTweetFunction = new GameFunction({
  name: "like_tweet",
  description: "Like a tweet to show engagement",
  args: [{ name: "tweet_id", description: "ID of tweet to like" }] as const,
  executable: async (_args, logger) => {
    try {
      logger("Liking tweet");
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        "Tweet liked (placeholder)"
      );
    } catch (error: any) {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Failed: ${error.message}`
      );
    }
  },
});

export default likeTweetFunction;
