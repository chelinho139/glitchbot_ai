import logger from "./log";

// Tweet interface for scoring
export interface TweetData {
  id: string;
  text: string;
  author_id?: string;
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
  created_at?: string;
  author?: {
    username: string;
    followers_count: number;
    verified?: boolean;
  };
}

// High-priority keywords for crypto, AI, and tech
const HIGH_PRIORITY_KEYWORDS = [
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
];

// Medium-priority keywords
const MEDIUM_PRIORITY_KEYWORDS = [
  "tech",
  "technology",
  "innovation",
  "digital",
  "software",
  "app",
  "platform",
  "data",
  "analytics",
  "cloud",
  "security",
  "privacy",
  "mobile",
  "ios",
  "android",
  "productivity",
  "workflow",
  "automation",
];

// Calculate keyword score based on content
export const calculateKeywordScore = (text: string): number => {
  const lowerText = text.toLowerCase();
  let score = 0;

  // High priority keywords (3 points each)
  for (const keyword of HIGH_PRIORITY_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      score += 3;
    }
  }

  // Medium priority keywords (1 point each)
  for (const keyword of MEDIUM_PRIORITY_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      score += 1;
    }
  }

  return Math.min(score, 15); // Cap at 15 points
};

// Calculate engagement velocity score
export const calculateEngagementScore = (tweet: TweetData): number => {
  if (!tweet.public_metrics || !tweet.created_at) return 0;

  const { retweet_count, like_count, reply_count, quote_count } =
    tweet.public_metrics;
  const totalEngagement =
    retweet_count + like_count + reply_count + quote_count;

  // Calculate age in hours
  const createdAt = new Date(tweet.created_at);
  const now = new Date();
  const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  // Avoid division by zero, minimum 0.5 hours
  const adjustedAge = Math.max(ageHours, 0.5);

  // Engagement per hour, scaled
  const velocityScore = Math.min((totalEngagement / adjustedAge) * 2, 20);

  return Math.round(velocityScore);
};

// Calculate author credibility score
export const calculateAuthorScore = (tweet: TweetData): number => {
  if (!tweet.author) return 0;

  const { followers_count, verified } = tweet.author;
  let score = 0;

  // Followers score (requirement: > 5k followers gets priority)
  if (followers_count > 50000) {
    score += 10;
  } else if (followers_count > 10000) {
    score += 7;
  } else if (followers_count > 5000) {
    score += 5;
  } else if (followers_count > 1000) {
    score += 2;
  }

  // Verification bonus
  if (verified) {
    score += 3;
  }

  return Math.min(score, 15); // Cap at 15 points
};

// Calculate sentiment score (basic positive/inquisitive detection)
export const calculateSentimentScore = (text: string): number => {
  const lowerText = text.toLowerCase();
  let score = 5; // Neutral baseline

  // Positive indicators
  const positiveWords = [
    "amazing",
    "awesome",
    "incredible",
    "fantastic",
    "excellent",
    "great",
    "love",
    "excited",
    "brilliant",
    "innovative",
    "breakthrough",
    "revolutionary",
  ];

  // Inquisitive indicators
  const inquisitiveWords = [
    "?",
    "how",
    "what",
    "why",
    "when",
    "where",
    "thoughts",
    "opinion",
    "think",
    "believe",
    "discuss",
    "explore",
    "curious",
    "wonder",
  ];

  // Negative indicators (reduce score)
  const negativeWords = [
    "hate",
    "terrible",
    "awful",
    "disgusting",
    "stupid",
    "idiotic",
    "scam",
    "fraud",
    "worthless",
    "garbage",
    "trash",
  ];

  // Count positive indicators
  for (const word of positiveWords) {
    if (lowerText.includes(word)) score += 2;
  }

  // Count inquisitive indicators
  for (const word of inquisitiveWords) {
    if (lowerText.includes(word)) score += 1;
  }

  // Penalize negative content
  for (const word of negativeWords) {
    if (lowerText.includes(word)) score -= 3;
  }

  return Math.max(0, Math.min(score, 10)); // Cap between 0-10
};

// Main scoring function
export const scoreTweet = (
  tweet: TweetData
): { score: number; reason: string } => {
  const keywordScore = calculateKeywordScore(tweet.text);
  const engagementScore = calculateEngagementScore(tweet);
  const authorScore = calculateAuthorScore(tweet);
  const sentimentScore = calculateSentimentScore(tweet.text);

  const totalScore =
    keywordScore + engagementScore + authorScore + sentimentScore;

  // Generate explanation
  const components = [
    `keywords: ${keywordScore}`,
    `engagement: ${engagementScore}`,
    `author: ${authorScore}`,
    `sentiment: ${sentimentScore}`,
  ];

  const reason = `Total: ${totalScore} (${components.join(", ")})`;

  logger.debug(
    {
      tweetId: tweet.id,
      totalScore,
      keywordScore,
      engagementScore,
      authorScore,
      sentimentScore,
    },
    "Tweet scored"
  );

  return { score: totalScore, reason };
};

// Filter tweets that meet minimum criteria
export const isWorthyCandidate = (tweet: TweetData): boolean => {
  const { score } = scoreTweet(tweet);

  // Minimum threshold for consideration
  const minScore = 8;

  // Additional filters
  const tooShort = tweet.text.length < 50;
  const tooLong = tweet.text.length > 500;
  const hasSpam = /(.)\1{4,}/.test(tweet.text); // Repeated characters

  if (tooShort || tooLong || hasSpam) {
    logger.debug(
      { tweetId: tweet.id },
      "Tweet filtered out: Failed basic filters"
    );
    return false;
  }

  return score >= minScore;
};
