// Level 3: GameFunction - Send DM
import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";

export const sendDMFunction = new GameFunction({
  name: "send_dm_to_owner",
  description: "Send DM alert to bot owner",
  args: [
    { name: "message", description: "Alert message content" },
    { name: "urgency", description: "Alert urgency level" },
  ] as const,
  executable: async (_args, logger) => {
    try {
      logger("Sending DM to owner");
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        "DM sent (placeholder)"
      );
    } catch (error: any) {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Failed: ${error.message}`
      );
    }
  },
});

export default sendDMFunction;
