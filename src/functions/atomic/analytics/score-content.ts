// Level 3: GameFunction - Enhanced Content Scoring
import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import {
  calculateKeywordScore,
  calculateEngagementScore,
  calculateAuthorScore,
  calculateSentimentScore,
} from "../../../lib/ranking";
import appLogger from "../../../lib/log";

// Enhanced content analysis interface
export interface ContentAnalysis {
  mention_score: number; // 0-10: Intent clarity, user authority
  referenced_score: number; // 0-10: Content quality, engagement, author authority
  combined_score: number; // 0-20: Total content value
  intent_type: string; // 'news_share', 'opinion_share', 'question', 'general'
  response_style: string; // 'news', 'opinion', 'question', 'standard'
  confidence: number; // 0-1: How confident we are in intent detection
  reasoning: string; // Human-readable explanation
}

// Intent detection patterns
const INTENT_PATTERNS = {
  news_share: [
    /breaking/i,
    /news/i,
    /report/i,
    /announces?/i,
    /launches?/i,
    /reveals?/i,
    /confirms?/i,
    /official/i,
    /statement/i,
    /update/i,
    /just in/i,
    /developing/i,
    /alert/i,
    /bulletin/i,
  ],
  opinion_share: [
    /think/i,
    /believe/i,
    /opinion/i,
    /perspective/i,
    /view/i,
    /thoughts?/i,
    /take on/i,
    /hot take/i,
    /unpopular opinion/i,
    /controversial/i,
    /debate/i,
    /argue/i,
    /disagree/i,
    /agree/i,
  ],
  question: [
    /\?/,
    /what.*think/i,
    /how.*feel/i,
    /should.*we/i,
    /why.*do/i,
    /help.*understand/i,
    /explain/i,
    /clarify/i,
    /confused/i,
    /question/i,
    /wondering/i,
    /curious/i,
    /thoughts\?/i,
  ],
};

// Analyze mention text for intent and quality
function analyzeMention(
  mentionText: string,
  mentionAuthor?: any
): {
  score: number;
  intent: string;
  confidence: number;
} {
  let score = 0;
  let intent = "general";
  let confidence = 0.3; // Default low confidence

  // Basic quality factors
  const textLength = mentionText.length;
  if (textLength >= 20 && textLength <= 280) score += 2; // Good length
  if (textLength >= 50) score += 1; // Substantial content

  // Intent detection with confidence scoring
  for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(mentionText)) {
        intent = intentType;
        confidence = Math.min(confidence + 0.2, 0.9); // Increase confidence
        score += 2; // Bonus for clear intent
        break;
      }
    }
    if (intent !== "general") break;
  }

  // Author authority scoring (if available)
  if (mentionAuthor?.public_metrics?.followers_count) {
    const followers = mentionAuthor.public_metrics.followers_count;
    if (followers > 10000) score += 2;
    else if (followers > 1000) score += 1;
  }

  if (mentionAuthor?.verified) score += 1;

  // Sentiment and engagement factors
  const sentimentScore = calculateSentimentScore(mentionText);
  score += Math.min(sentimentScore / 2, 2); // Up to 2 points from sentiment

  return {
    score: Math.min(score, 10),
    intent,
    confidence,
  };
}

// Analyze referenced tweet for quality and engagement
function analyzeReferencedTweet(tweetData?: any): {
  score: number;
  reasoning: string;
} {
  if (!tweetData) {
    return { score: 0, reasoning: "No referenced tweet data" };
  }

  let score = 0;
  const reasons: string[] = [];

  // Use existing ranking system for baseline
  const keywordScore = calculateKeywordScore(tweetData.text || "");
  const engagementScore = calculateEngagementScore(tweetData);
  const authorScore = calculateAuthorScore({
    ...tweetData,
    author: {
      username: tweetData.author_username || "",
      followers_count: tweetData.author?.public_metrics?.followers_count || 0,
      verified: tweetData.author?.verified || false,
    },
  });

  // Scale scores to fit 0-10 range
  score += Math.min(keywordScore / 1.5, 3); // Up to 3 points
  score += Math.min(engagementScore / 2, 4); // Up to 4 points
  score += Math.min(authorScore / 1.5, 3); // Up to 3 points

  reasons.push(`keywords: ${Math.round(keywordScore)}`);
  reasons.push(`engagement: ${Math.round(engagementScore)}`);
  reasons.push(`author: ${Math.round(authorScore)}`);

  return {
    score: Math.min(score, 10),
    reasoning: reasons.join(", "),
  };
}

// Map intent to response style
function getResponseStyle(intent: string): string {
  const styleMap: Record<string, string> = {
    news_share: "news",
    opinion_share: "opinion",
    question: "question",
    general: "standard",
  };
  return styleMap[intent] || "standard";
}

// Main content analysis function
export function analyzeContent(args: {
  mention_text: string;
  mention_author?: any;
  referenced_tweet?: any;
  referenced_author?: any;
}): ContentAnalysis {
  // Analyze mention
  const mentionAnalysis = analyzeMention(
    args.mention_text,
    args.mention_author
  );

  // Analyze referenced tweet
  const referencedAnalysis = analyzeReferencedTweet(args.referenced_tweet);

  // Combine scores
  const combinedScore = mentionAnalysis.score + referencedAnalysis.score;

  // Generate reasoning
  const reasoning = [
    `Mention: ${mentionAnalysis.score}/10 (intent: ${mentionAnalysis.intent})`,
    `Referenced: ${referencedAnalysis.score}/10 (${referencedAnalysis.reasoning})`,
    `Combined: ${combinedScore}/20`,
  ].join(" | ");

  return {
    mention_score: Math.round(mentionAnalysis.score * 10) / 10,
    referenced_score: Math.round(referencedAnalysis.score * 10) / 10,
    combined_score: Math.round(combinedScore * 10) / 10,
    intent_type: mentionAnalysis.intent,
    response_style: getResponseStyle(mentionAnalysis.intent),
    confidence: mentionAnalysis.confidence,
    reasoning,
  };
}

// Updated GameFunction using new analysis system
export const scoreContentFunction = new GameFunction({
  name: "score_content",
  description:
    "Analyze mention and referenced tweet content for quality and intent",
  args: [
    { name: "mention_text", description: "Text of the mention" },
    { name: "mention_author", description: "Author data for the mention" },
    {
      name: "referenced_tweet",
      description: "Referenced tweet data from includes",
    },
    { name: "referenced_author", description: "Referenced tweet author data" },
  ] as const,
  executable: async (args, logger) => {
    try {
      const startTime = Date.now();

      logger("Starting enhanced content analysis...");

      // Validate required arguments
      if (!args.mention_text) {
        throw new Error("mention_text is required");
      }

      const analysis = analyzeContent({
        mention_text: args.mention_text,
        mention_author: args.mention_author,
        referenced_tweet: args.referenced_tweet,
        referenced_author: args.referenced_author,
      });

      const executionTime = Date.now() - startTime;

      appLogger.info(
        {
          combined_score: analysis.combined_score,
          intent_type: analysis.intent_type,
          response_style: analysis.response_style,
          confidence: analysis.confidence,
          execution_time_ms: executionTime,
        },
        "Content analysis completed"
      );

      logger(
        `Content analyzed: ${analysis.combined_score}/20 (${analysis.intent_type}) in ${executionTime}ms`
      );

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify(analysis)
      );
    } catch (error: any) {
      appLogger.error({ error: error.message }, "Content analysis failed");
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Content analysis failed: ${error.message}`
      );
    }
  },
});

// Export both the function and analysis utility
export default scoreContentFunction;
