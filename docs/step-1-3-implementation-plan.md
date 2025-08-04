# 🚀 **Step 1.3: Content-Aware Responses & Tweet Curation**

## **Phased Implementation Plan**

### 📊 **Current State Analysis**

#### ✅ **What We Already Have:**

- [x] Queue-based mention processing with retry logic
- [x] Rate limiting and error handling
- [x] Basic acknowledgment responses
- [x] `referenced_tweets` data in API response (we just need to extract it!)

#### 🎯 **What We're Building:**

- [ ] Content-aware response generation
- [ ] Referenced tweet storage for future workers
- [ ] Enhanced content scoring and prioritization
- [ ] **Zero additional API calls** - using existing data smarter

---

## 🏗️ **Phase-by-Phase Implementation**

### **Phase 1A: Enhanced API Data Collection (30 mins)**

_Goal: Get complete referenced tweet data in existing API call_

#### **Tasks:**

- [x] **Enhance API request parameters** in `rate-limited-twitter-client.ts`
  - [x] Add `referenced_tweets.id.author_id` to expansions
  - [x] Add `text` and `context_annotations` to tweet.fields
  - [x] Test enhanced API request
- [x] **Test data availability** - verify we get complete referenced tweet info
  - [x] Check `includes.tweets` contains referenced tweet data
  - [x] Check `includes.users` contains referenced tweet authors
  - [x] Verify no additional API calls consumed
- [x] **Update interfaces** to handle enhanced response data
  - [x] Update `TwitterMention` interface if needed
  - [x] Update `FetchMentionsResult` interface if needed

#### **Code Changes:**

```typescript
// In fetchUserMentions() - enhance existing expansions
expansions: [
  "author_id",
  "referenced_tweets.id",
  "referenced_tweets.id.author_id"  // NEW: Get referenced tweet authors
],
"tweet.fields": [
  "created_at",
  "public_metrics",
  "referenced_tweets",
  "text",                    // NEW: Ensure complete text
  "context_annotations"      // NEW: Content topic detection
],
```

#### **Success Criteria:**

- [x] API response includes complete referenced tweet data in `includes.tweets`
- [x] Referenced tweet authors available in `includes.users`
- [x] No additional API calls consumed
- [x] All existing functionality still works

---

### **Phase 1B: Database Schema Update (15 mins)**

_Goal: Add candidate_tweets table for storing interesting content_

#### **Tasks:**

- [x] **Add `candidate_tweets` table** to `DatabaseManager.createEngagementSchema()`
  - [x] Add table creation SQL to `createEngagementSchema()`
  - [x] Add appropriate indexes for performance
  - [x] Test schema migration
- [x] **Test database migration** on existing glitchbot.db
  - [x] Backup existing database (automatic with WAL mode)
  - [x] Run schema update
  - [x] Verify existing data intact
- [x] **Add helper interfaces** for candidate tweet operations
  - [x] Create `CandidateTweet` interface
  - [x] Add to exports in appropriate files

#### **Database Schema:**

```sql
CREATE TABLE IF NOT EXISTS candidate_tweets (
  tweet_id TEXT PRIMARY KEY,                -- Original tweet ID (not mention ID)
  author_id TEXT NOT NULL,                  -- Original author ID
  author_username TEXT NOT NULL,            -- Original author username
  content TEXT NOT NULL,                    -- Original tweet text
  created_at TEXT NOT NULL,                 -- Original tweet timestamp
  public_metrics TEXT,                      -- Engagement data (JSON)
  discovered_via_mention_id TEXT NOT NULL,  -- Which mention led us to this
  discovery_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  curation_score REAL DEFAULT 0            -- Content quality score (0-20)
);

CREATE INDEX IF NOT EXISTS idx_candidate_tweets_score
  ON candidate_tweets(curation_score DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_tweets_discovery
  ON candidate_tweets(discovery_timestamp DESC);
```

#### **Success Criteria:**

- [x] Database creates new table without errors
- [x] Existing data remains intact
- [x] Can insert/query candidate tweets
- [x] Indexes created for performance

---

### **Phase 1C: Referenced Tweet Extraction (45 mins)**

_Goal: Extract and process referenced tweet data from API response_

#### **Tasks:**

- [ ] **Create extraction utility** to parse referenced tweets from API response
  - [ ] Create `extractReferencedTweets()` method in MentionsWorker
  - [ ] Handle mapping tweet IDs to full tweet objects
  - [ ] Handle mapping author IDs to user objects
  - [ ] Add error handling for missing data
- [ ] **Add extraction to MentionsWorker** processing flow
  - [ ] Integrate extraction into `execute()` method
  - [ ] Add logging for extracted tweets
  - [ ] Test with existing queue processing
- [ ] **Test extraction logic** with real mentions containing referenced tweets
  - [ ] Test with quote tweets
  - [ ] Test with reply mentions
  - [ ] Test with mentions that have no referenced tweets

#### **Implementation Structure:**

```typescript
// New utility function in MentionsWorker
private extractReferencedTweets(mentionsData: FetchMentionsResult): ReferencedTweetData[] {
  const referencedTweets = [];

  for (const mention of mentionsData.mentions) {
    if (mention.referenced_tweets?.length > 0) {
      // Find full tweet data in includes.tweets
      // Find author data in includes.users
      // Create candidate tweet object
      referencedTweets.push(candidateTweet);
    }
  }

  return referencedTweets;
}
```

#### **Success Criteria:**

- [ ] Successfully extracts referenced tweet data from API response
- [ ] Maps tweet IDs to full tweet objects from includes
- [ ] Maps author IDs to user objects from includes
- [ ] Handles cases where referenced tweets don't exist in includes
- [ ] Proper error handling and logging

---

### **Phase 2A: Enhanced Content Scoring (45 mins)**

_Goal: Implement real content scoring for mention + referenced tweet quality_

#### **Tasks:**

- [ ] **Replace placeholder `score_content`** with real implementation
  - [ ] Update `src/functions/atomic/analytics/score-content.ts`
  - [ ] Implement scoring algorithms
  - [ ] Add comprehensive error handling
- [ ] **Add scoring algorithms** for mentions and referenced tweets
  - [ ] Mention scoring: intent clarity, user authority, sentiment
  - [ ] Referenced tweet scoring: engagement, author authority, content relevance
  - [ ] Combined scoring logic
- [ ] **Test scoring accuracy** with various content types
  - [ ] Test with news content
  - [ ] Test with opinion/discussion content
  - [ ] Test with questions
  - [ ] Test with low-quality content

#### **Scoring Interface:**

```typescript
interface ContentAnalysis {
  mention_score: number; // 0-10: Intent clarity, user authority
  referenced_score: number; // 0-10: Content quality, engagement, author authority
  combined_score: number; // 0-20: Total content value
  intent_type: string; // 'news_share', 'opinion_share', 'question', 'general'
  response_style: string; // 'news', 'opinion', 'question', 'standard'
}
```

#### **Scoring Factors:**

- [ ] **Mention Analysis:**
  - [ ] Intent detection (keywords, patterns)
  - [ ] Sentiment analysis
  - [ ] User credibility (followers, verification)
- [ ] **Referenced Tweet Analysis:**
  - [ ] Engagement metrics (likes, retweets, replies)
  - [ ] Author authority (followers, verification)
  - [ ] Content relevance (keywords, topics)
  - [ ] Recency factor

#### **Success Criteria:**

- [ ] Content scores range appropriately (0-20)
- [ ] Different content types get different scores
- [ ] High-quality content (news, viral tweets) scores higher
- [ ] Intent classification works accurately
- [ ] Performance is acceptable (<100ms per analysis)

---

### **Phase 2B: Candidate Tweet Storage (30 mins)**

_Goal: Store interesting referenced tweets in database_

#### **Tasks:**

- [ ] **Create storage GameFunction** `store_candidate_tweet`
  - [ ] Create new file `src/functions/atomic/utilities/store-candidate-tweet.ts`
  - [ ] Implement storage logic with deduplication
  - [ ] Add comprehensive error handling
- [ ] **Add storage logic** to MentionsWorker processing
  - [ ] Integrate storage into processing flow
  - [ ] Add storage criteria logic
  - [ ] Add logging for stored tweets
- [ ] **Test storage workflow** with scored content
  - [ ] Test successful storage
  - [ ] Test duplicate handling
  - [ ] Test storage criteria filtering

#### **Storage Criteria:**

```typescript
// Store if any of these conditions:
// - Content score >= 12 (high quality)
// - Referenced tweet engagement > 1000 likes
// - Author has > 10k followers
// - Contains trending topics/keywords
```

#### **Storage Function Structure:**

- [ ] Input validation
- [ ] Duplicate checking (tweet_id exists)
- [ ] JSON serialization of metrics
- [ ] Database insertion
- [ ] Error handling and logging

#### **Success Criteria:**

- [ ] High-quality referenced tweets stored in candidate_tweets table
- [ ] Low-quality content filtered out
- [ ] No duplicates stored (tweet_id PRIMARY KEY handles this)
- [ ] Storage criteria working correctly
- [ ] Performance acceptable for queue processing

---

### **Phase 3A: Content-Aware Response Generation (45 mins)**

_Goal: Generate contextual responses based on mention + referenced content_

#### **Tasks:**

- [ ] **Create response templates** for different content types
  - [ ] News sharing templates
  - [ ] Opinion sharing templates
  - [ ] Question templates
  - [ ] General mention templates
- [ ] **Update reply logic** in MentionsWorker to use content analysis
  - [ ] Replace simple acknowledgment with content-aware responses
  - [ ] Add template selection logic
  - [ ] Add username personalization
- [ ] **Test response quality** with various mention scenarios
  - [ ] Test news sharing responses
  - [ ] Test opinion sharing responses
  - [ ] Test question responses
  - [ ] Test general mention responses

#### **Response Templates:**

```typescript
const responseTemplates = {
  news_share: [
    "Thanks for sharing this news! 📰 Looks interesting, I'll take a closer look",
    "Appreciate you bringing this to my attention! 🗞️ Fascinating development",
  ],
  opinion_share: [
    "Thanks for tagging me on this perspective! 🤔 Interesting viewpoint",
    "Appreciate you including me in this discussion! 💭 I'll consider this",
  ],
  question: [
    "Thanks for bringing this to my attention! 🤖 I'll analyze this",
    "Appreciate the question! 🧠 Let me take a look at this",
  ],
  general: [
    "Thanks for mentioning me, @{username}! 🤖",
    "Appreciate the mention, @{username}! 👋",
  ],
};
```

#### **Response Generation Logic:**

- [ ] Intent type determines template category
- [ ] Random selection within category for variety
- [ ] Username personalization
- [ ] Emoji usage for friendliness
- [ ] Character limit compliance

#### **Success Criteria:**

- [ ] Responses acknowledge the specific content being shared
- [ ] Different tones for news vs opinions vs questions
- [ ] Natural, friendly language that feels human
- [ ] No repetitive responses
- [ ] All responses under 280 characters

---

### **Phase 3B: Priority-Based Processing (30 mins)**

_Goal: Update mention priority based on content quality_

#### **Tasks:**

- [ ] **Update mention priority** in queue based on content score
  - [ ] Add priority calculation logic
  - [ ] Update `pending_mentions.priority` field
  - [ ] Ensure queue ordering respects priority
- [ ] **Test priority ordering** - high-quality content processed first
  - [ ] Test with mixed priority mentions
  - [ ] Verify processing order
  - [ ] Test queue behavior under load
- [ ] **Add priority logging** for monitoring
  - [ ] Log priority assignments
  - [ ] Log processing order
  - [ ] Add priority to queue status scripts

#### **Priority Logic:**

```typescript
// Update pending_mentions.priority based on content score:
// Score 18-20: Priority 1 (process immediately)
// Score 15-17: Priority 2 (high priority)
// Score 10-14: Priority 3 (normal priority)
// Score 5-9:   Priority 4 (low priority)
// Score 0-4:   Priority 5 (lowest priority)
```

#### **Implementation:**

- [ ] Add priority calculation function
- [ ] Update `store_pending_mentions` to set priority
- [ ] Verify `get_processable_mentions` respects priority order
- [ ] Add priority monitoring to queue status

#### **Success Criteria:**

- [ ] High-quality content mentions processed first
- [ ] Priority visible in database and logs
- [ ] Queue ordering respects content-based priority
- [ ] Priority calculation is consistent
- [ ] Monitoring shows priority distribution

---

## 🚀 **Implementation Timeline**

### **Week 1:**

- [ ] **Day 1**: Phase 1A + 1B (Enhanced API + Database)
  - [ ] Morning: Phase 1A (API Enhancement)
  - [ ] Afternoon: Phase 1B (Database Schema)
- [ ] **Day 2**: Phase 1C (Data Extraction)
  - [ ] Full day: Referenced tweet extraction implementation
- [ ] **Day 3**: Phase 2A (Content Scoring)
  - [ ] Full day: Content scoring algorithm implementation

### **Week 2:**

- [ ] **Day 1**: Phase 2B (Tweet Storage)
  - [ ] Full day: Candidate tweet storage implementation
- [ ] **Day 2**: Phase 3A (Smart Responses)
  - [ ] Full day: Content-aware response generation
- [ ] **Day 3**: Phase 3B (Priority Processing) + Testing
  - [ ] Morning: Priority-based processing
  - [ ] Afternoon: End-to-end testing and validation

---

## 🧪 **Testing Strategy Per Phase**

### **Testing Pattern for Each Phase:**

- [ ] **Unit Tests**: Test individual functions
- [ ] **Integration Tests**: Test phase with existing system
- [ ] **Manual Tests**: Real mentions with different content types
- [ ] **Data Validation**: Verify database state and API calls

### **Phase Testing Checklists:**

#### **Phase 1A Testing:**

- [x] Enhanced API request returns expected data
- [x] `includes.tweets` contains referenced tweet data
- [x] `includes.users` contains referenced tweet authors
- [x] No additional API calls consumed
- [x] Existing functionality unaffected

#### **Phase 1B Testing:**

- [ ] Database schema creates successfully
- [ ] Existing data remains intact
- [ ] Can insert candidate tweets
- [ ] Can query candidate tweets
- [ ] Indexes improve query performance

#### **Phase 1C Testing:**

- [ ] Extract quote tweet references correctly
- [ ] Extract reply tweet references correctly
- [ ] Handle mentions with no references
- [ ] Error handling for missing includes data
- [ ] Logging provides useful information

#### **Phase 2A Testing:**

- [ ] Score high-quality news content highly
- [ ] Score low-quality content appropriately
- [ ] Intent classification accuracy >80%
- [ ] Performance <100ms per analysis
- [ ] Edge cases handled gracefully

#### **Phase 2B Testing:**

- [ ] High-quality tweets stored successfully
- [ ] Low-quality tweets filtered out
- [ ] Duplicate tweets not stored
- [ ] Storage criteria working correctly
- [ ] Database performance acceptable

#### **Phase 3A Testing:**

- [ ] News content gets news-style responses
- [ ] Opinion content gets opinion-style responses
- [ ] Questions get question-style responses
- [ ] Responses are natural and varied
- [ ] Username personalization works

#### **Phase 3B Testing:**

- [ ] High-priority mentions processed first
- [ ] Priority calculation is consistent
- [ ] Queue ordering respects priority
- [ ] Monitoring shows priority distribution
- [ ] Performance impact is minimal

### **Example Manual Tests:**

- [ ] **Test Scenario 1**: `@glitchbot_ai check out this breaking news!` (with news article)
  - [ ] Expected: High content score, news-style response, stored in candidate_tweets
- [ ] **Test Scenario 2**: `@glitchbot_ai what do you think about this opinion?` (with opinion tweet)
  - [ ] Expected: Medium content score, opinion-style response, may be stored
- [ ] **Test Scenario 3**: `@glitchbot_ai help me understand this` (with technical content)
  - [ ] Expected: Medium content score, question-style response, processing priority

---

## 📊 **Success Metrics by Phase**

### **Phase 1 Completion:**

- [x] ✅ Complete referenced tweet data available in API response
- [x] ✅ Database schema updated with candidate_tweets table
- [ ] ✅ Referenced tweet extraction working correctly

### **🎉 Phase 1A: COMPLETE & VALIDATED!**

- [x] ✅ Enhanced API request parameters working
- [x] ✅ Complete referenced tweet content captured in `includes.tweets`
- [x] ✅ Referenced tweet authors captured in `includes.users`
- [x] ✅ Context annotations support added
- [x] ✅ Zero additional API calls (rate limit efficient)
- [x] ✅ Real-world validation with live Twitter mention
- [x] ✅ Full conversation context available (@VraserX → @cheloeth → @glitchbot_ai)

### **🎉 Phase 1B: COMPLETE & VALIDATED!**

- [x] ✅ `candidate_tweets` table created in DatabaseManager
- [x] ✅ Complete schema with all required fields (author, content, metrics, scoring)
- [x] ✅ Performance indexes created (score DESC, discovery DESC, author)
- [x] ✅ Updated `CandidateTweet` interface to match database schema
- [x] ✅ Successful database migration (existing data intact)
- [x] ✅ Full CRUD operations tested and working
- [x] ✅ Ready for referenced tweet storage in upcoming phases

### **Phase 2 Completion:**

- [ ] ✅ Content scoring algorithm implemented and tested
- [ ] ✅ High-quality referenced tweets stored in database
- [ ] ✅ Storage criteria filtering appropriately

### **Phase 3 Completion:**

- [ ] ✅ Context-aware responses working for all content types
- [ ] ✅ Priority-based processing implemented
- [ ] ✅ End-to-end workflow validated

### **Overall Step 1.3 Success:**

- [ ] ✅ Responses acknowledge specific shared content
- [ ] ✅ High-quality tweets stored for future workers
- [ ] ✅ Processing prioritizes valuable content
- [ ] ✅ Zero additional API rate limit consumption
- [ ] ✅ User experience significantly improved
- [ ] ✅ Foundation set for DiscoveryWorker integration

---

## 📝 **Notes & Considerations**

### **Development Notes:**

- [ ] Keep all changes backward compatible
- [ ] Maintain existing error handling patterns
- [ ] Follow existing logging conventions
- [ ] Use existing database transaction patterns

### **Performance Considerations:**

- [ ] Content scoring should be <100ms per mention
- [ ] Database operations should be optimized
- [ ] API enhancements should not slow existing calls
- [ ] Priority processing should not impact queue performance

### **Future Integration Points:**

- [ ] Candidate tweets will feed DiscoveryWorker
- [ ] Content scoring will inform EngagementWorker
- [ ] Priority system will support advanced scheduling
- [ ] Response templates will enable personality development

---

**Ready to start with Phase 1A? Each phase builds incrementally on the previous one!** 🎯
