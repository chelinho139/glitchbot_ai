// Level 3: GameFunction - Fetch Timeline
import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";

export const fetchTimelineFunction = new GameFunction({
  name: "fetch_home_timeline",
  description: "Fetch home timeline or aggregate from followees",
  args: [{ name: "count", description: "Number of tweets to fetch" }] as const,
  executable: async (_args, logger) => {
    try {
      logger("Fetching home timeline");
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        "Timeline fetched (placeholder)"
      );
    } catch (error: any) {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Failed: ${error.message}`
      );
    }
  },
});

export default fetchTimelineFunction;
