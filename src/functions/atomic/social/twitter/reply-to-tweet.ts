// Level 3: GameFunction - Reply to Tweet
import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";

export const replyToTweetFunction = new GameFunction({
  name: "reply_to_tweet",
  description: "Reply to a specific tweet after checking cadence guards",
  args: [
    { name: "tweet_id", description: "ID of tweet to reply to" },
    { name: "reply_text", description: "The reply content" },
  ] as const,
  executable: async (_args, logger) => {
    try {
      logger("Replying to tweet");
      // TODO: Check cadence, post reply, update database
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        "Reply posted (placeholder)"
      );
    } catch (error: any) {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Failed: ${error.message}`
      );
    }
  },
});

export default replyToTweetFunction;
