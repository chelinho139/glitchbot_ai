# 🔍 DiscoveryWorker - Content Discovery & Curation

**Priority**: MEDIUM  
**Response Time**: Background (interruptible for priority)  
**Location**: `src/workers/twitter/discovery-worker.ts`

## 🎯 Purpose & Responsibilities

The **DiscoveryWorker** is GlitchBot's content intelligence engine, continuously scanning multiple sources to find, score, and curate high-quality content for engagement. It operates as a sophisticated content pipeline that feeds the EngagementWorker with premium content candidates.

### **Core Mission**

- Discover high-signal content from multiple sources
- Score and filter content based on quality criteria
- Maintain a curated pipeline of engagement candidates
- Handle priority analysis requests from other workers

## ⚡ Characteristics

### **Priority Level**: MEDIUM

- **Response Time**: Background (interruptible for priority requests)
- **Triggers**: scheduled_scans, priority_requests, keyword_alerts
- **Personality**: analytical, thorough, quality-focused
- **Conflicts**: None - can run alongside other workers

### **Operational Behavior**

- **Continuous Operation**: Background scanning with scheduled intervals
- **Priority Interruptible**: Can handle urgent requests from MentionsWorker
- **Multi-source Discovery**: Scans multiple content sources simultaneously
- **Quality-focused**: Strict filtering and scoring standards

## 🔧 Core Functions

### **1. `search_tweets`** - Keyword-Based Discovery

**Type**: Atomic Function  
**Purpose**: Find content by keywords, hashtags, and topics

**Search Parameters**:

- `keywords`: Array of search terms (DeFi, AI, Web3, etc.)
- `hashtags`: Relevant hashtags to monitor
- `language`: Target language (default: English)
- `max_results`: Maximum tweets to return per search
- `since_id`: Only search tweets after this ID

**Search Strategy**:

- **High-Priority Keywords**: DeFi, AI, Web3, GameFi, innovation
- **Medium-Priority Keywords**: crypto, blockchain, technology, startup
- **Trending Topics**: Monitor viral content in relevant spaces
- **Author Targeting**: Focus on key influencers and thought leaders

### **2. `fetch_timeline`** - Account Monitoring

**Type**: Atomic Function  
**Purpose**: Monitor specific accounts and influencers for content

**Monitoring Strategy**:

- **Key Influencers**: Top voices in DeFi, AI, and emerging tech
- **Project Accounts**: Official accounts of important projects
- **Thought Leaders**: Industry experts and innovators
- **Community Leaders**: Active community members and moderators

**Account Categories**:

- **Tier 1**: High-follower accounts with proven track record
- **Tier 2**: Emerging voices with growing influence
- **Tier 3**: Community leaders and active participants

### **3. `fetch_trending`** - Viral Content Discovery

**Type**: Atomic Function  
**Purpose**: Discover trending topics and viral content

**Trending Sources**:

- **Twitter Trends**: Platform-wide trending topics
- **Topic Clusters**: Related conversations and hashtags
- **Viral Tweets**: High-engagement content in relevant spaces
- **Breaking News**: Real-time developments in target areas

**Trending Strategy**:

- **Relevance Filtering**: Only trending topics in target domains
- **Quality Assessment**: Evaluate viral content quality
- **Timing Optimization**: Capture trending content early
- **Engagement Potential**: Assess community response likelihood

### **4. `score_content`** - Quality Evaluation

**Type**: Atomic Function  
**Purpose**: Rate content quality on a 1-20 scale

**Scoring Criteria**:

#### **Keyword Relevance (0-5 points)**

- **High Priority**: DeFi, AI, Web3, GameFi, innovation (5 points)
- **Medium Priority**: crypto, blockchain, technology (3 points)
- **Low Priority**: general tech, business (1 point)
- **Irrelevant**: Off-topic content (0 points)

#### **Author Authority (0-5 points)**

- **Verified + High Followers**: 5 points
- **Verified + Medium Followers**: 4 points
- **High Followers + Good History**: 3 points
- **Medium Followers + Active**: 2 points
- **Low Followers or New**: 1 point

#### **Engagement Metrics (0-5 points)**

- **High Engagement Rate**: 5 points
- **Good Engagement Rate**: 3-4 points
- **Average Engagement**: 2 points
- **Low Engagement**: 1 point

#### **Content Quality (0-5 points)**

- **Insightful/Educational**: 5 points
- **Interesting/Informative**: 3-4 points
- **Basic Information**: 2 points
- **Low Value**: 1 point

### **5. `cache_candidates`** - Content Storage

**Type**: Atomic Function  
**Purpose**: Store high-quality content in the candidate pipeline

**Caching Strategy**:

- **Score-based Storage**: Only cache content above quality threshold
- **Priority Flagging**: Mark high-priority content for immediate use
- **Metadata Storage**: Store scoring details and discovery context
- **Expiration Management**: Set appropriate cache expiration times

**Cache Categories**:

- **Quote Candidates**: High-scoring content for quote tweets
- **Reply Opportunities**: Content for strategic replies
- **Thought Leadership**: Content for expert commentary
- **Community Building**: Content for community engagement

### **6. `cleanup_cache`** - Pipeline Maintenance

**Type**: Atomic Function  
**Purpose**: Remove stale or processed content from cache

**Cleanup Rules**:

- **Age-based**: Remove content older than 24 hours
- **Score-based**: Remove content below quality threshold
- **Processed**: Remove content that has been engaged with
- **Duplicate**: Remove duplicate or similar content

### **7. `analyze_patterns`** - Learning & Optimization

**Type**: Analytics Function  
**Purpose**: Learn from successful content and optimize discovery

**Pattern Analysis**:

- **Successful Content Types**: What performs well in engagement
- **Optimal Discovery Times**: When to find the best content
- **Author Performance**: Which authors consistently produce quality content
- **Topic Trends**: Emerging topics and themes

### **8. `priority_analysis`** - User-Requested Analysis

**Type**: Workflow Function  
**Purpose**: Handle urgent analysis requests from MentionsWorker

**Priority Analysis Process**:

1. **Request Validation**: Verify the analysis request
2. **Content Fetching**: Retrieve the specific content
3. **Deep Analysis**: Perform comprehensive scoring and analysis
4. **Result Caching**: Store analysis results for potential engagement
5. **Response Preparation**: Prepare analysis summary for user

## 🎭 Discovery Strategy

### **Multi-Source Discovery**

**Primary Sources**:

1. **Keyword Searches**: Targeted searches for relevant content
2. **Account Monitoring**: Following key influencers and projects
3. **Trending Topics**: Viral content in relevant spaces
4. **User Suggestions**: Community-driven content curation
5. **Reply Chains**: Valuable conversations to join

**Discovery Frequency**:

- **High-Priority Sources**: Every 15 minutes
- **Medium-Priority Sources**: Every 30 minutes
- **Low-Priority Sources**: Every hour
- **Trending Monitoring**: Every 10 minutes

### **Content Pipeline Flow**

```
Input Sources → Discovery → Scoring → Filtering → Caching → Engagement
     ↓              ↓         ↓         ↓         ↓         ↓
  Keywords      Search    Quality    Quality   Storage   Worker
  Accounts      Fetch     Score      Filter    Cache     Query
  Trending      Monitor   Analyze    Validate  Expire    Retrieve
  User Input    Process   Evaluate   Rank      Cleanup   Consume
```

### **Quality Thresholds**

**Score Categories**:

- **Score 15+**: High priority for quotes (immediate engagement)
- **Score 10-14**: Medium priority candidates (scheduled engagement)
- **Score 5-9**: Low priority backup content (fill-in engagement)
- **Score <5**: Filtered out (not cached)

## 🔄 Cross-Worker Coordination

### **Priority Request Handling**

```typescript
// Handle urgent analysis requests from MentionsWorker
async handlePriorityRequest(request) {
  const { tweet_id, requested_by, urgency } = request;

  // Perform immediate analysis
  const analysis = await this.performDeepAnalysis(tweet_id);

  // Cache with high priority
  await this.cacheWithPriority(analysis, 'user_suggested');

  // Return analysis results
  return {
    score: analysis.score,
    insights: analysis.insights,
    recommendation: analysis.recommendation
  };
}
```

### **Content Pipeline Integration**

```typescript
// Provide content to EngagementWorker
async getContentForEngagement(criteria) {
  const { min_score, content_type, priority, max_age } = criteria;

  return await this.queryCache({
    min_score,
    content_type,
    priority,
    max_age_hours: max_age
  });
}
```

### **Performance Feedback Loop**

```typescript
// Learn from EngagementWorker performance
async receivePerformanceFeedback(feedback) {
  const { content_id, engagement_success, metrics } = feedback;

  // Update content patterns
  await this.updateSuccessPatterns(content_id, engagement_success);

  // Adjust scoring weights if needed
  await this.optimizeScoringWeights(metrics);
}
```

## 📊 Performance Metrics

### **Discovery Metrics**

- **Content Volume**: Number of tweets discovered per hour
- **Quality Distribution**: Distribution of content scores
- **Source Effectiveness**: Which sources produce the best content
- **Discovery Speed**: Time from content creation to discovery

### **Pipeline Metrics**

- **Cache Hit Rate**: Percentage of worker queries satisfied from cache
- **Cache Efficiency**: Storage utilization and cleanup effectiveness
- **Content Freshness**: Average age of cached content
- **Pipeline Throughput**: Content processed per time period

### **Quality Metrics**

- **Scoring Accuracy**: Correlation between scores and engagement success
- **False Positives**: High-scoring content that doesn't perform well
- **False Negatives**: Low-scoring content that would have performed well
- **Score Distribution**: Balance of content across score ranges

### **Operational Metrics**

- **API Efficiency**: Optimal use of Twitter API rate limits
- **Processing Speed**: Time to discover, score, and cache content
- **Error Rates**: Failed discovery attempts and recovery
- **Resource Usage**: CPU and memory utilization

## 🛡️ Error Handling

### **API Failures**

- **Rate Limit Handling**: Respect and adapt to API limits
- **Retry Logic**: Exponential backoff for temporary failures
- **Fallback Sources**: Use alternative sources when primary fails
- **Error Reporting**: Log and report persistent issues

### **Content Quality Issues**

- **Spam Detection**: Filter out spam and low-quality content
- **Duplicate Detection**: Avoid caching duplicate content
- **Sensitivity Filtering**: Flag potentially controversial content
- **Quality Validation**: Verify content meets minimum standards

### **System Issues**

- **Cache Corruption**: Detect and repair cache issues
- **Memory Management**: Prevent memory leaks and overflow
- **Performance Degradation**: Monitor and optimize processing speed
- **Resource Exhaustion**: Handle resource constraints gracefully

## 🔧 Configuration

### **Discovery Parameters**

```typescript
const DISCOVERY_CONFIG = {
  search_intervals: {
    high_priority: 15, // minutes
    medium_priority: 30, // minutes
    low_priority: 60, // minutes
  },
  max_results_per_search: 100,
  quality_thresholds: {
    cache_minimum: 5,
    quote_candidate: 15,
    reply_opportunity: 10,
  },
  cache_expiration: {
    quote_candidates: 24, // hours
    reply_opportunities: 12, // hours
    general_content: 6, // hours
  },
};
```

### **Scoring Weights**

```typescript
const SCORING_WEIGHTS = {
  keyword_relevance: 0.25,
  author_authority: 0.25,
  engagement_metrics: 0.25,
  content_quality: 0.25,
};
```

### **Source Priorities**

```typescript
const SOURCE_PRIORITIES = {
  tier1_influencers: 1.0,
  tier2_influencers: 0.8,
  verified_accounts: 0.9,
  community_leaders: 0.7,
  general_users: 0.5,
};
```

## 🎯 Success Criteria

### **Immediate Goals**

- **Discovery Volume**: 100+ quality tweets discovered per day
- **Quality Score**: >10/20 average content score
- **Cache Hit Rate**: >80% of worker queries satisfied from cache
- **Processing Speed**: <30 seconds from discovery to cache

### **Long-term Goals**

- **Content Intelligence**: Predictive content discovery
- **Quality Optimization**: Continuously improving scoring accuracy
- **Source Optimization**: Identifying and prioritizing best sources
- **Pipeline Efficiency**: Maximizing content throughput and quality

---

**The DiscoveryWorker is GlitchBot's intelligence engine, ensuring a constant supply of high-quality, relevant content for meaningful community engagement.**
