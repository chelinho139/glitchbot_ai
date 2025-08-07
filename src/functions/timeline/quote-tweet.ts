import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";

/**
 * Dummy quote-tweet function for testing.
 * Takes a tweet_id and a comment, and prints them to the console.
 * No actual Twitter API call is made.
 */
const quoteTweetFunction = new GameFunction({
  name: "quote_tweet",
  description:
    "Quote-tweets a tweet with a comment (dummy, just prints for now)",
  args: [
    {
      name: "tweet_id",
      description: "The ID of the tweet to quote",
    },
    {
      name: "comment",
      description: "The comment to add to the quote tweet",
    },
  ] as const,
  executable: async (args, logger) => {
    const { tweet_id, comment } = args;
    if (!tweet_id || !comment) {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        "tweet_id and comment are required"
      );
    }
    const message = `\n🗣️ QUOTE TWEET\nTweet ID: ${tweet_id}\nComment: ${comment}\n`;
    console.log(message);
    logger(`Quote-tweeted (dummy): ${tweet_id} | ${comment}`);
    return new ExecutableGameFunctionResponse(
      ExecutableGameFunctionStatus.Done,
      message
    );
  },
});

export default quoteTweetFunction;
