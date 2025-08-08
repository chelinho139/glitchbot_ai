import GlitchBotDB from "./db";
import logger from "./log";

// Sleep window: 02:00–10:00 UTC-3 (05:00–13:00 UTC)
export const isSleepTime = (d = new Date()): boolean => {
  const h = d.getUTCHours(); // UTC-3 sleep 02:00–10:00 -> UTC 05:00–13:00
  return h >= 5 && h < 13;
};

// Check if enough time has passed since last quote (1 hour)
export const canQuoteNow = (db: GlitchBotDB, now = new Date()): boolean => {
  const lastQuoteTs = db.getCadence("last_quote_ts");
  if (!lastQuoteTs) return true;

  const timeSinceLastQuote = now.getTime() - new Date(lastQuoteTs).getTime();
  const oneHourMs = 60 * 60 * 1000;

  return timeSinceLastQuote >= oneHourMs;
};

// Check if enough time has passed since last reply (1 minute)
export const canReplyNow = (db: GlitchBotDB, now = new Date()): boolean => {
  const lastReplyTs = db.getCadence("last_reply_ts");
  if (!lastReplyTs) return true;

  const timeSinceLastReply = now.getTime() - new Date(lastReplyTs).getTime();
  const oneMinuteMs = 60 * 1000;

  return timeSinceLastReply >= oneMinuteMs;
};

// Update quote timestamp after successful quote
export const updateQuoteTimestamp = (
  db: GlitchBotDB,
  timestamp = new Date()
): void => {
  db.setCadence("last_quote_ts", timestamp.toISOString());
  logger.info(
    { timestamp: timestamp.toISOString() },
    "Quote timestamp updated"
  );
};

// Update reply timestamp after successful reply
export const updateReplyTimestamp = (
  db: GlitchBotDB,
  timestamp = new Date()
): void => {
  db.setCadence("last_reply_ts", timestamp.toISOString());
  logger.info(
    { timestamp: timestamp.toISOString() },
    "Reply timestamp updated"
  );
};

// Check all cadence guards before posting
export const checkAllGuards = (
  db: GlitchBotDB,
  action: "quote" | "reply"
): boolean => {
  const now = new Date();

  // No sleep window check (removed per requirements)

  // Check specific action cadence
  if (action === "quote" && !canQuoteNow(db, now)) {
    logger.info("Quote cadence not met (< 1 hour since last quote)");
    return false;
  }

  if (action === "reply" && !canReplyNow(db, now)) {
    logger.info("Reply cadence not met (< 1 minute since last reply)");
    return false;
  }

  return true;
};

// Get time until next allowed action
export const getTimeUntilNextAction = (
  db: GlitchBotDB,
  action: "quote" | "reply"
): number => {
  const now = new Date();

  // If in sleep window, return time until sleep ends
  if (isSleepTime(now)) {
    const currentHour = now.getUTCHours();
    let hoursUntilWake;

    if (currentHour >= 5 && currentHour < 13) {
      hoursUntilWake = 13 - currentHour;
    } else {
      // This shouldn't happen if isSleepTime() is correct, but just in case
      hoursUntilWake = 0;
    }

    return hoursUntilWake * 60 * 60 * 1000; // Convert to milliseconds
  }

  // Calculate time until next allowed action
  if (action === "quote") {
    const lastQuoteTs = db.getCadence("last_quote_ts");
    if (!lastQuoteTs) return 0;

    const nextAllowedTime = new Date(lastQuoteTs).getTime() + 60 * 60 * 1000;
    return Math.max(0, nextAllowedTime - now.getTime());
  }

  if (action === "reply") {
    const lastReplyTs = db.getCadence("last_reply_ts");
    if (!lastReplyTs) return 0;

    const nextAllowedTime = new Date(lastReplyTs).getTime() + 60 * 1000;
    return Math.max(0, nextAllowedTime - now.getTime());
  }

  return 0;
};
