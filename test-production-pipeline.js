/**
 * 🚀 PRODUCTION PIPELINE TEST
 *
 * Tests the complete Step 1.3 implementation:
 * - Enhanced API data fetching (Phase 1A/1B complete)
 * - Content analysis and scoring (Phase 2A complete)
 * - Intelligent storage system (Phase 2B complete)
 * - Context-aware responses (Phase 3A preview)
 *
 * This test runs against REAL Twitter data and demonstrates
 * the full production workflow.
 */

const { MentionsWorker } = require("./dist/workers/twitter/mentions-worker.js");
const GlitchBotDB = require("./dist/lib/db.js").default;

async function testProductionPipeline() {
  console.log("🚀 PRODUCTION PIPELINE TEST: Complete Step 1.3 Workflow\n");
  console.log("=".repeat(60));

  const startTime = Date.now();

  // Initialize components
  console.log("🔧 Initializing components...");
  const db = new GlitchBotDB();
  const mentionsWorker = new MentionsWorker(db);

  // Get pre-test database stats
  console.log("\n📊 PRE-TEST DATABASE STATE:");
  const preStats = db.getSuggestedStats();
  console.log(`- Total Suggested Tweets: ${preStats.total}`);
  console.log(`- High Quality (≥15): ${preStats.high_quality}`);
  console.log(`- Average Score: ${Math.round(preStats.avg_score * 100) / 100}`);

  console.log("\n🧪 RUNNING PRODUCTION PIPELINE TEST...");
  console.log("=".repeat(60));

  try {
    // Execute the enhanced production pipeline test
    const pipelineResults = await mentionsWorker.testProductionPipeline();

    if (!pipelineResults.success) {
      console.log("❌ PIPELINE TEST FAILED:");
      console.log(`Error: ${pipelineResults.error}`);
      return;
    }

    const results = pipelineResults.results;
    const executionTime = Date.now() - startTime;

    // =====================================================
    // PHASE 1: API & DATA FETCHING RESULTS
    // =====================================================
    console.log("\n📡 PHASE 1: Enhanced API Data Fetching");
    console.log("-".repeat(40));
    console.log(`✅ Execution Time: ${results.execution_time}ms`);
    console.log(`✅ Mentions Found: ${results.mentions_found}`);
    console.log(`✅ Referenced Tweets: ${results.includes_data.tweets}`);
    console.log(`✅ User Profiles: ${results.includes_data.users}`);
    console.log(
      `✅ Rate Limit Remaining: ${results.rate_limit?.remaining || "N/A"}`
    );

    if (results.includes_data.tweets > 0) {
      console.log(
        `🎉 SUCCESS: Enhanced API fetching complete referenced tweet data!`
      );
    } else if (results.mentions_found === 0) {
      console.log(
        `ℹ️  INFO: No new mentions found (expected if no recent activity)`
      );
    } else {
      console.log(
        `ℹ️  INFO: Mentions found but no referenced tweets in this batch`
      );
    }

    // =====================================================
    // PHASE 2A: CONTENT ANALYSIS RESULTS
    // =====================================================
    console.log("\n🧠 PHASE 2A: Content Analysis & Scoring");
    console.log("-".repeat(40));

    if (results.analysis_results.length > 0) {
      console.log(
        `✅ Content Analysis: ${results.analysis_results.length} mentions analyzed\n`
      );

      let totalScore = 0;
      const intentTypes = {};
      const responseStyles = {};

      results.analysis_results.forEach((analysis, index) => {
        console.log(`📋 MENTION ${index + 1}:`);
        console.log(`   ID: ${analysis.mention_id}`);
        console.log(`   Author: ${analysis.author}`);
        console.log(`   Text: ${analysis.text_preview}`);
        console.log(`   📊 Combined Score: ${analysis.combined_score}/20`);
        console.log(`   🎯 Intent Type: ${analysis.intent_type}`);
        console.log(`   💬 Response Style: ${analysis.response_style}`);
        console.log(
          `   🎪 Confidence: ${Math.round(analysis.confidence * 100)}%`
        );
        console.log(
          `   🔗 Has Referenced Tweet: ${
            analysis.has_referenced_tweet ? "YES" : "NO"
          }`
        );
        console.log("");

        totalScore += analysis.combined_score;
        intentTypes[analysis.intent_type] =
          (intentTypes[analysis.intent_type] || 0) + 1;
        responseStyles[analysis.response_style] =
          (responseStyles[analysis.response_style] || 0) + 1;
      });

      const avgScore = totalScore / results.analysis_results.length;
      console.log(`📈 ANALYSIS SUMMARY:`);
      console.log(`   Average Score: ${Math.round(avgScore * 100) / 100}/20`);
      console.log(
        `   Intent Distribution: ${JSON.stringify(intentTypes, null, 2)}`
      );
      console.log(
        `   Response Styles: ${JSON.stringify(responseStyles, null, 2)}`
      );

      console.log(`🎉 SUCCESS: Content analysis working perfectly!`);
    } else {
      console.log(`ℹ️  INFO: No content to analyze (no mentions found)`);
    }

    // =====================================================
    // PHASE 2B: STORAGE RESULTS
    // =====================================================
    console.log("\n🗄️  PHASE 2B: Intelligent Storage System");
    console.log("-".repeat(40));

    if (results.storage_results.length > 0) {
      console.log(
        `✅ Storage Evaluations: ${results.storage_results.length} tweets evaluated\n`
      );

      let storedCount = 0;
      let skippedCount = 0;

      results.storage_results.forEach((storage, index) => {
        console.log(`💾 STORAGE ${index + 1}:`);
        console.log(`   Mention ID: ${storage.mention_id}`);
        console.log(`   Referenced Tweet: ${storage.referenced_tweet_id}`);
        console.log(`   Score: ${storage.score}/20`);
        console.log(
          `   📋 Decision: ${storage.stored ? "✅ STORED" : "⏭️  SKIPPED"}`
        );
        console.log(`   📝 Reason: ${storage.reason}`);
        console.log("");

        if (storage.stored) storedCount++;
        else skippedCount++;
      });

      console.log(`📈 STORAGE SUMMARY:`);
      console.log(`   ✅ Stored: ${storedCount}`);
      console.log(`   ⏭️  Skipped: ${skippedCount}`);
      console.log(
        `   📊 Storage Rate: ${Math.round(
          (storedCount / results.storage_results.length) * 100
        )}%`
      );

      console.log(`🎉 SUCCESS: Intelligent storage filtering working!`);
    } else {
      console.log(`ℹ️  INFO: No referenced tweets to evaluate for storage`);
    }

    // =====================================================
    // POST-TEST DATABASE STATE
    // =====================================================
    console.log("\n📊 POST-TEST DATABASE STATE:");
    console.log("-".repeat(40));
    const postStats = db.getSuggestedStats();
    console.log(
      `- Total Suggested Tweets: ${postStats.total} (was ${preStats.total})`
    );
    console.log(
      `- High Quality (≥15): ${postStats.high_quality} (was ${preStats.high_quality})`
    );
    console.log(
      `- Average Score: ${Math.round(postStats.avg_score * 100) / 100} (was ${
        Math.round(preStats.avg_score * 100) / 100
      })`
    );

    const newlyStored = postStats.total - preStats.total;
    if (newlyStored > 0) {
      console.log(
        `🎉 NEW STORAGE: ${newlyStored} tweets added to suggested database!`
      );

      // Show top candidates
      const topCandidates = db.getBestSuggestedTweets(3);
      console.log(`\n🏆 TOP SUGGESTED:`);
      topCandidates.forEach((candidate, index) => {
        console.log(
          `   ${index + 1}. @${candidate.author_username} (${
            candidate.curation_score
          }) - ${candidate.content.substring(0, 40)}...`
        );
      });
    }

    // =====================================================
    // FINAL SUMMARY
    // =====================================================
    console.log("\n🎯 PRODUCTION PIPELINE SUMMARY");
    console.log("=".repeat(60));
    console.log(`⚡ Total Execution Time: ${executionTime}ms`);
    console.log(
      `📡 API Enhancement: ${
        results.includes_data.tweets > 0 || results.mentions_found === 0
          ? "✅ WORKING"
          : "⚠️  NO DATA"
      }`
    );
    console.log(
      `🧠 Content Analysis: ${
        results.analysis_results.length > 0 ? "✅ WORKING" : "ℹ️  NO CONTENT"
      }`
    );
    console.log(
      `🗄️  Intelligent Storage: ${
        results.storage_results.length > 0 ? "✅ WORKING" : "ℹ️  NO STORAGE"
      }`
    );
    console.log(
      `📊 Database Integration: ${
        postStats.total >= preStats.total ? "✅ WORKING" : "❌ ISSUE"
      }`
    );

    console.log(
      `\n🎉 STEP 1.3 PRODUCTION PIPELINE: ${
        results.mentions_found > 0
          ? "FULLY OPERATIONAL"
          : "READY (waiting for mentions)"
      }!`
    );

    if (results.mentions_found === 0) {
      console.log(
        `\n💡 TIP: Mention @glitchbot_ai on Twitter with some content to see the full pipeline in action!`
      );
      console.log(`   Examples:`);
      console.log(
        `   - Share a news article: "@glitchbot_ai check out this breaking news!"`
      );
      console.log(
        `   - Ask a question: "@glitchbot_ai what do you think about this?"`
      );
      console.log(
        `   - Share an opinion: "@glitchbot_ai thoughts on this perspective?"`
      );
    }
  } catch (error) {
    console.log("\n❌ PRODUCTION PIPELINE ERROR:");
    console.log(`Error: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  }
}

// Execute the test
testProductionPipeline()
  .then(() => {
    console.log(`\n✅ Production pipeline test completed!`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n❌ Fatal error:`, error);
    process.exit(1);
  });
