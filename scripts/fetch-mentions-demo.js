#!/usr/bin/env ts-node

/**
 * Quick test to call fetch_mentions and see results
 */

require("dotenv").config();

const {
  default: fetchMentionsFunction,
} = require("../src/functions/atomic/social/twitter/fetch-mentions");

async function testFetchMentions() {
  console.log("🧪 Testing fetch_mentions with max_results: 5");
  console.log("=".repeat(50));

  try {
    const result = await fetchMentionsFunction.executable(
      {
        max_results: "5",
      },
      (msg) => console.log(`[Log]: ${msg}`)
    );

    console.log("\n📊 Function Result:");
    console.log(`   Status: ${result.status}`);

    if (result.status === "done") {
      const data = JSON.parse(result.feedback);

      console.log("\n📋 Mentions Data:");
      console.log(`   Found: ${data.mentions.length} mentions`);
      console.log(`   API Result Count: ${data.meta.result_count}`);
      console.log(`   Newest ID: ${data.meta.newest_id || "None"}`);
      console.log(`   Oldest ID: ${data.meta.oldest_id || "None"}`);

      if (data.rate_limit) {
        console.log(
          `   Rate Limit: ${data.rate_limit.remaining}/${data.rate_limit.limit}`
        );
      }

      if (data.mentions.length > 0) {
        console.log("\n📝 YOUR MENTIONS:");
        console.log("=".repeat(60));

        data.mentions.forEach((mention, i) => {
          const author = mention.author;
          const username = author?.username || "unknown";
          const displayName = author?.name || username;

          console.log(`\n${i + 1}. 👤 @${username}`);
          if (author?.name && author.name !== username) {
            console.log(`   📛 Name: ${author.name}`);
          }

          // Author verification and metrics
          if (author?.verified) {
            console.log(
              `   ✅ Verified ${
                author.verified_type ? `(${author.verified_type})` : "account"
              }`
            );
          }
          if (author?.public_metrics) {
            console.log(
              `   👥 ${author.public_metrics.followers_count.toLocaleString()} followers • ${author.public_metrics.following_count.toLocaleString()} following`
            );
          }

          // Author bio and location
          if (author?.description) {
            console.log(
              `   📝 Bio: ${author.description.substring(0, 100)}${
                author.description.length > 100 ? "..." : ""
              }`
            );
          }
          if (author?.location) {
            console.log(`   📍 Location: ${author.location}`);
          }

          console.log(`   📅 ${new Date(mention.created_at).toLocaleString()}`);
          console.log(`   💬 "${mention.text}"`);

          // Check if this tweet is referencing another tweet
          if (
            mention.referenced_tweets &&
            mention.referenced_tweets.length > 0
          ) {
            mention.referenced_tweets.forEach((ref) => {
              const refType =
                ref.type === "replied_to"
                  ? "Reply to"
                  : ref.type === "quoted"
                  ? "Quote of"
                  : ref.type === "retweeted"
                  ? "Retweet of"
                  : ref.type;
              console.log(`   🔗 ${refType} tweet: ${ref.id}`);
            });
          } else {
            console.log(`   📝 Original tweet (not a reply/quote)`);
          }

          if (mention.public_metrics) {
            console.log(
              `   📊 ${mention.public_metrics.like_count} ❤️  ${mention.public_metrics.retweet_count} 🔄  ${mention.public_metrics.reply_count} 💬`
            );
          }

          console.log(`   🔗 Tweet ID: ${mention.id}`);
          console.log(`   🔗 Profile: https://twitter.com/${username}`);
        });
      } else {
        console.log("\n📭 No mentions in the current API response window");
        console.log(
          "💡 Your bot has been mentioned, but tweets are outside current time window"
        );
        console.log("💡 Try mentioning your bot freshly to see real-time data");
      }
    } else {
      console.log(`\n❌ Function failed: ${result.feedback}`);
    }
  } catch (error) {
    console.error(`\n💥 Error: ${error.message}`);
  }
}

testFetchMentions();
