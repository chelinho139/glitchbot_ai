import pino from "pino";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configure logger with structured output
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "yyyy-mm-dd HH:MM:ss",
      ignore: "pid,hostname",
    },
  },
  base: {
    name: "GlitchBot",
  },
});

export default logger;
