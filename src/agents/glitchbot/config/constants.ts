// GlitchBot Configuration Constants
//
// Centralized configuration values for the GlitchBot agent

export const GLITCHBOT_CONFIG = {
  // Agent Identity
  NAME: "GlitchBot",
  GOAL: "Engage authentically with the crypto/AI/tech community on Twitter",

  // Cadence Rules
  QUOTE_CADENCE_HOURS: 2,
  REPLY_CADENCE_MINUTES: 1,
  AGENT_LOOP_INTERVAL_SECONDS: 60,

  // Sleep Schedule (UTC-3 → UTC conversion)
  SLEEP_START_HOUR_UTC: 5, // 02:00 UTC-3 → 05:00 UTC
  SLEEP_END_HOUR_UTC: 13, // 10:00 UTC-3 → 13:00 UTC

  // Content Rules
  MAX_TWEET_LENGTH: 280,
  MAX_EMOJIS_PER_TWEET: 1,
  MIN_TWEET_SCORE: 8,

  // Focus Topics
  HIGH_PRIORITY_KEYWORDS: [
    // Crypto/DeFi
    "bitcoin",
    "btc",
    "ethereum",
    "eth",
    "defi",
    "crypto",
    "blockchain",
    "solana",
    "sol",
    "memecoin",
    "degen",
    "yield",
    "farming",
    "liquidity",
    "staking",
    "airdrop",
    "dao",
    "nft",
    "web3",
    "tokenomics",

    // AI/ML
    "ai",
    "artificial intelligence",
    "machine learning",
    "ml",
    "llm",
    "gpt",
    "claude",
    "openai",
    "anthropic",
    "neural",
    "model",
    "training",
    "transformer",
    "deep learning",
    "generative",
    "chatgpt",
    "automation",

    // Tech/Startups
    "startup",
    "funding",
    "series a",
    "series b",
    "vc",
    "venture capital",
    "launch",
    "product hunt",
    "github",
    "open source",
    "api",
    "developer",
    "coding",
    "programming",
    "typescript",
    "javascript",
    "react",
    "node",
    "saas",
    "b2b",
    "technical",
    "engineering",
    "frontend",
    "backend",
  ],

  // Owner Information
  OWNER_HANDLE: "lemoncheli",

  // API Limits
  MAX_MENTIONS_PER_FETCH: 50,
  MAX_TIMELINE_TWEETS: 20,
  MAX_SEARCH_RESULTS: 20,
} as const;

export type GlitchBotConfig = typeof GLITCHBOT_CONFIG;

export default GLITCHBOT_CONFIG;
