#!/usr/bin/env node
// Test script for get-timeline function

const {
  getTimelineFunction,
} = require("./dist/functions/timeline/get-timeline.js");

console.log("🧪 Testing get-timeline Function v2");
console.log("============================================================");
console.log("✅ Function loaded successfully!");
console.log("Function name:", getTimelineFunction.name);
console.log(
  "Args:",
  getTimelineFunction.args.map((arg) => arg.name)
);
console.log(
  "Description preview:",
  getTimelineFunction.description.substring(0, 120) + "..."
);

async function testGetTimeline() {
  console.log("\n🚀 Starting get-timeline test...");

  try {
    // Test the function with default parameters
    const result = await getTimelineFunction.executable(
      {
        max_results: "10", // Fetch 10 tweets for testing
        exclude: "replies", // Exclude replies for cleaner feed
      },
      (message) => console.log("[LOGGER]", message)
    );

    console.log("\n✅ Function executed successfully!");
    console.log("Status:", result.status);
    console.log("Data received:", result.feedback ? "✅ YES" : "❌ NO");

    // Parse the result if successful (data is in feedback, not result)
    if (result.status === "done" && result.feedback) {
      try {
        const timelineData = JSON.parse(result.feedback);
        console.log("\n📊 Timeline Data Summary:");
        console.log("Tweets fetched:", timelineData.tweets.length);
        console.log("Result count:", timelineData.meta.result_count);
        console.log("Newest ID:", timelineData.meta.newest_id || "none");
        console.log(
          "Rate limit remaining:",
          timelineData.rate_limit?.remaining || "unknown"
        );

        if (timelineData.tweets.length > 0) {
          console.log("\n🐦 Sample Tweet (First):");
          const firstTweet = timelineData.tweets[0];
          console.log("ID:", firstTweet.id);
          console.log(
            "Author:",
            firstTweet.author?.username || firstTweet.author_id
          );
          console.log("Text:", firstTweet.text.substring(0, 100) + "...");
          console.log("Likes:", firstTweet.public_metrics?.like_count || 0);
          console.log(
            "Retweets:",
            firstTweet.public_metrics?.retweet_count || 0
          );
        }
      } catch (parseError) {
        console.log("❌ Failed to parse result as JSON:", parseError.message);
        console.log("Raw result:", result.result);
      }
    } else {
      console.log(
        "❌ Function failed or no result:",
        result.feedback || result.result || "No result"
      );
    }
  } catch (error) {
    console.log("💥 Test failed with error:", error.message);
    console.log("Stack:", error.stack);
  }
}

// Run the test
testGetTimeline();
