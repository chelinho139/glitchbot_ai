# 🤖 GlitchBot - AI Twitter Agent

**GlitchBot** is an autonomous Twitter bot powered by the Virtuals G.A.M.E (Generative Autonomous Multi-Agent Engine) framework. Built with a sophisticated 3-level architecture, GlitchBot delivers intelligent, contextual social media engagement focused on DeFi, AI, and emerging technologies.

## 🏗️ Architecture Overview

GlitchBot implements the complete 3-level G.A.M.E hierarchy:

### 📋 **Level 1: GameAgent (High-Level Planner)**

- **GlitchBotAgent** - Strategic decision making and goal prioritization
- Orchestrates multiple specialized workers
- Makes high-level decisions about engagement strategy
- Manages sleep schedules and system-wide priorities

### ⚡ **Level 2: GameWorkers (Specialized Task Execution)**

#### **Twitter Workers (Social Media Operations)**

- **🔥 MentionsWorker** - _CRITICAL Priority_

  - Real-time response to mentions and DMs (< 5 minutes)
  - Intent recognition and cross-worker task delegation
  - Community relationship building
  - Handles "@GlitchBot check this tweet" scenarios

- **📈 EngagementWorker** - _HIGH Priority_

  - Proactive content creation and quote tweets
  - Strategic replies to valuable conversations
  - Respects 2-hour cadence for quotes, 60s for replies
  - Quality-focused content strategy (score > 15/20)

- **🔍 DiscoveryWorker** - _MEDIUM Priority_
  - Continuous content discovery and curation
  - Multi-source scanning (keywords, accounts, trending)
  - Intelligent content scoring and filtering
  - Handles priority analysis requests from other workers

#### **System Workers (Infrastructure Management)**

- **📊 MonitoringWorker** - _LOW Priority_

  - System health and performance monitoring
  - API rate limit tracking and alerts
  - Error pattern analysis and reporting
  - Performance optimization insights

- **🧹 MaintenanceWorker** - _LOW Priority_

  - Database cleanup and optimization
  - Log rotation and storage management
  - Scheduled maintenance during sleep windows
  - Data integrity validation and backups

- **🤝 CoordinationWorker** - _MEDIUM Priority_
  - Cross-worker communication and task routing
  - Resource conflict resolution
  - Shared state synchronization
  - System-wide event broadcasting

### 🔧 **Level 3: GameFunctions (Atomic Actions)**

#### **Atomic Functions (Single-Purpose)**

- **Social/Twitter**: `fetch_mentions`, `search_tweets`, `post_tweet`, `like_tweet`, `send_dm`
- **Analytics**: `score_content`, `analyze_sentiment`, `track_engagement`
- **Utilities**: `check_cadence`, `validate_content`, `manage_locks`

#### **Workflow Functions (Multi-Step Processes)**

- **`quote_tweet_workflow`**: Complete quote tweet process with commentary
- **`reply_workflow`**: Context-aware reply generation and posting
- **`discovery_workflow`**: Multi-source content discovery and scoring

## 🔗 Global Coordination Layer

### **EngagementTracker**

- Prevents duplicate engagement across workers
- Tracks engagement history and success patterns
- Coordinates system-wide engagement strategy

### **ReservationManager**

- Manages shared resource access (content, API quotas, DB connections)
- Priority-based resource allocation
- Queue management for high-demand resources

### **RateLimiter** ✅ **IMPLEMENTED**

- **Automatic & Transparent**: Zero boilerplate - all API calls automatically rate limited
- **Persistent Tracking**: SQLite-based tracking across 15min/hour/day windows
- **Fair Share Allocation**: Priority-based allocation with worker fair-share distribution
- **Twitter API Sync**: Syncs with actual Twitter rate limit headers
- **Enterprise Ready**: Comprehensive error handling and monitoring

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- TypeScript
- Twitter API access (v2)
- Virtuals G.A.M.E API key

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp env.example .env

# Configure your environment variables
# VIRTUALS_API_KEY=your_api_key
# GAME_TWITTER_TOKEN=your_token (or Twitter app keys)
```

### Development

```bash
# Development mode
npm run dev

# Build project
npm run build

# Production start
npm run start

# Run tests
npm run test
```

## 🎯 Bot Behavior & Strategy

### **Engagement Strategy**

- **Quote Tweets**: High-impact content (score 15+) with thoughtful commentary
- **Strategic Replies**: Value-added contributions to important conversations
- **Community Building**: Responsive interaction with mentions and DMs
- **Thought Leadership**: Insights on DeFi, AI, Web3, and emerging tech

### **Content Discovery**

- **Keyword Monitoring**: DeFi, AI, Web3, GameFi, innovation terms
- **Account Watching**: Key influencers and thought leaders
- **Trending Analysis**: Viral content in relevant spaces
- **Community Curation**: User-suggested content analysis

### **Quality Standards**

- **Content Scoring**: 20-point scale based on relevance, engagement, authority
- **Timing Intelligence**: Optimal posting times and cadence management
- **Brand Consistency**: Authentic, helpful, technically insightful voice
- **Community Focus**: Building relationships over metrics

### **Operational Rules**

- **Sleep Schedule**: 05:00-13:00 UTC (quiet hours)
- **Quote Cadence**: Minimum 2 hours between quote tweets
- **Reply Cadence**: Minimum 60 seconds between replies (relaxed for mentions)
- **API Respect**: Intelligent rate limiting and error handling

## 📊 Worker Coordination Examples

### **User-Directed Content Analysis**

```
User: "@GlitchBot check out this DeFi innovation: [tweet_link]"
     ↓
MentionsWorker: Detects intent, delegates to DiscoveryWorker
     ↓
CoordinationWorker: Routes priority analysis request
     ↓
DiscoveryWorker: Performs priority content analysis
     ↓
MentionsWorker: Reports results back to user
```

### **Cross-Worker Content Flow**

```
DiscoveryWorker: Finds high-quality content (score 18/20)
     ↓
EngagementTracker: Reserves content for quote tweet
     ↓
EngagementWorker: Creates thoughtful quote with commentary
     ↓
RateLimiter: Ensures API quota availability
     ↓
Post published & engagement tracked
```

## 🛡️ Rate Limiting System

GlitchBot features an **enterprise-grade rate limiting system** that provides automatic protection against Twitter API rate limits with zero boilerplate code.

### **✨ Key Features**

- **🔄 Transparent Operation**: All `TwitterApi` calls automatically rate limited
- **📊 Persistent Tracking**: SQLite database tracks usage across time windows
- **⚖️ Fair Share Allocation**: Multiple workers get fair distribution of API quota
- **🎯 Priority System**: Critical operations (replies) bypass fair-share limits
- **🔗 Twitter Sync**: Syncs with actual Twitter rate limit headers
- **📈 Multi-Window Tracking**: 15-minute, hourly, and daily limit enforcement

### **🚀 Implementation**

```typescript
// Before: Manual rate limit handling
const twitterClient = new TwitterApi({ gameTwitterAccessToken: token });
// ... manual rate limit checks and error handling

// After: Automatic rate limiting (zero changes needed!)
const twitterClient = createRateLimitedTwitterClient({
  gameTwitterAccessToken: token,
  workerId: "mentions-worker",
  defaultPriority: "high",
});
// All API calls now automatically rate limited!
```

### **📋 Configured API Endpoints**

| Endpoint         | 15min Limit | Priority | Fair Share       |
| ---------------- | ----------- | -------- | ---------------- |
| `fetch_mentions` | 75 req      | HIGH     | ✅ Yes           |
| `get_user`       | 300 req     | MEDIUM   | ✅ Yes           |
| `reply_tweet`    | 50 req      | CRITICAL | ❌ No (Priority) |
| `like_tweet`     | 75 req      | LOW      | ✅ Yes           |
| `search_tweets`  | 180 req     | MEDIUM   | ✅ Yes           |

### **🎯 Usage Monitoring**

```bash
# Check current rate limit status
sqlite3 glitchbot.db "SELECT endpoint, window_type, requests_used FROM rate_limits;"

# Monitor rate limiting in real-time
tail -f logs/glitchbot.log | grep "rate limit"
```

## 🔧 Configuration

### **Environment Variables**

```bash
# Required
VIRTUALS_API_KEY=your_virtuals_api_key

# Twitter Authentication (choose one method)
GAME_TWITTER_TOKEN=your_game_twitter_token
# OR
TWITTER_APP_KEY=your_app_key
TWITTER_APP_SECRET=your_app_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret

# Optional
DATABASE_PATH=./glitchbot.db
LOG_LEVEL=info
OWNER_HANDLE=your_handle
NODE_ENV=production
```

### **Worker Priorities**

- **CRITICAL**: MentionsWorker (< 5 min response time)
- **HIGH**: EngagementWorker (strategic content creation)
- **MEDIUM**: DiscoveryWorker, CoordinationWorker (background processing)
- **LOW**: MonitoringWorker, MaintenanceWorker (system maintenance)

## 📈 Performance & Monitoring

### **Health Metrics**

- API rate limit utilization
- Worker response times
- Engagement success rates
- Content quality scores
- System resource usage

### **Operational Alerts**

- API rate limit warnings (>80%)
- High error rates (>5%)
- Worker performance degradation
- Database size and performance issues

## 🛠️ Database Management & Monitoring

### **📊 Database Inspection Tools**

Comprehensive tools for monitoring the mention queue system and database health:

#### **Complete Database Inspector**

```bash
npm run db:inspect
```

- Shows all database tables with schemas and row counts
- Special formatting for queue-related tables (`pending_mentions`, `mention_state`, etc.)
- Database file information and comprehensive statistics
- Queue analytics and system health overview

#### **Quick Queue Status Check**

```bash
npm run queue:status
```

- Concise queue statistics and processing status
- Rate limit usage across all endpoints
- Recent activity summary and trends
- Pending mentions organized by priority

### **🔧 Database Management Commands**

#### **Backup Database**

```bash
npm run db:backup
```

**Features:**

- Creates timestamped backups in `./backups/` directory
- Generates both binary (`.db`) and SQL dump (`.sql`) formats
- Shows backup history and automatically cleans up old backups
- Maintains last 10 backups automatically

#### **Reset Database (Development Only)**

```bash
npm run db:reset          # Interactive reset with confirmation
npm run db:reset:force    # Force reset for scripts (no confirmation)
```

**Safety Features:**

- ⚠️ **Production Protection**: Automatically blocked in production environments
- 💾 **Auto-Backup**: Creates backup before reset
- 🔨 **Clean Rebuild**: Clears `dist/` and rebuilds fresh schema
- ✅ **Verification**: Confirms all tables created successfully

### **📖 Documentation**

**Comprehensive Database Documentation:**

- **[Database Schema Guide](./docs/database-schema.md)** - Complete schema reference, monitoring queries, troubleshooting procedures
- **[Implementation Guide](./docs/implementation-guide.md)** - Development roadmap, testing procedures, success criteria

### **🔍 Key Monitoring Metrics**

- **Queue Health**: Pending vs completed mention ratios, processing success rates
- **Processing Performance**: Completion percentage, throughput, retry statistics
- **Rate Limits**: API usage across different endpoints and time windows
- **System State**: Checkpoint consistency, worker activity, error patterns
- **Data Integrity**: Duplicate detection, retry logic, queue persistence

### **🚨 Operational Procedures**

- **Daily Health Check**: `npm run queue:status` - Monitor queue depth and completion rates
- **Weekly Backup**: `npm run db:backup` - Create safety backups
- **Troubleshooting**: See [Database Schema docs](./docs/database-schema.md#operational-procedures) for detailed procedures

## 🔄 Development Roadmap

### **Current Status: Phase 1 Week 1 Complete ✅**

**✅ Architecture Complete:**

- [x] 3-level G.A.M.E hierarchy implemented
- [x] Specialized worker classes created
- [x] Global coordination layer designed
- [x] Atomic and workflow functions structured
- [x] Database schema and persistence layer
- [x] Comprehensive documentation

**✅ MentionsWorker Foundation (Step 1.1):**

- [x] **`fetch_mentions` GameFunction** with Twitter API v2 integration
- [x] **Enterprise Rate Limiting System** with automatic API protection
- [x] **Comprehensive Error Handling** and structured logging
- [x] **Test Framework** with 7 passing test cases
- [x] **Real API Integration** with Twitter mentions timeline

**✅ MentionsWorker Queue System (Step 1.2):**

- [x] **Persistent Mention Queue** with zero data loss guarantee
- [x] **AI-Managed GameFunctions** for autonomous worker decisions
- [x] **Rate-Limit-Aware Processing** handling 282:1 fetch/reply mismatch
- [x] **Database Schema** with `pending_mentions` and `mention_state` tables
- [x] **Complete Workflow** from fetch → store → process → reply → track
- [x] **Production Testing** with real queue operations and monitoring
- [x] **Database Inspection Tools** for debugging and monitoring

### **Next Phase: Complete MentionsWorker Implementation**

- [ ] Step 1.3: Basic intent recognition and response templates
- [ ] Step 1.4: Advanced response handling and conversation context
- [ ] Worker orchestration and coordination
- [ ] Real-time cross-worker communication

## 🤝 Contributing

GlitchBot is built with extensibility in mind. The modular worker architecture makes it easy to add new capabilities:

1. **Add new workers**: Extend the system with specialized workers for new platforms or capabilities
2. **Create custom functions**: Implement domain-specific GameFunctions for unique behaviors
3. **Enhance coordination**: Improve cross-worker communication and resource management
4. **Optimize performance**: Contribute to monitoring, caching, and efficiency improvements

## 📄 License

[License file details]

---

**GlitchBot**: Autonomous. Intelligent. Community-focused.
