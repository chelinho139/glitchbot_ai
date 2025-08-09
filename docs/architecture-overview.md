# 🏗️ GlitchBot Architecture Overview

**GlitchBot** implements a sophisticated 3-level hierarchical architecture based on the Virtuals G.A.M.E (Generative Autonomous Multi-Agent Engine) framework. This document provides a comprehensive overview of the system design, component relationships, and operational patterns.

## 🎯 Architecture Philosophy

GlitchBot follows the **separation of concerns** principle with clear hierarchical boundaries:

- **Level 1**: Strategic decision making and goal prioritization
- **Level 2**: Specialized task execution with domain expertise
- **Level 3**: Atomic operations and reusable functions
- **Global Layer**: Cross-component coordination and resource management

## 📋 Level 1: GameAgent (High-Level Planner)

### **GlitchBotAgent** - Strategic Decision Maker

**Location**: `src/glitchbot-agent.ts`

**Purpose**: The top-level orchestrator that makes strategic decisions about:

- What tasks to prioritize (mentions vs discovery vs engagement)
- When to be active (sleep schedule management)
- Overall goal achievement and learning from outcomes
- Worker coordination and resource allocation

**Key Responsibilities**:

- Strategic goal setting and prioritization
- Worker lifecycle management
- System-wide performance monitoring
- High-level error handling and recovery

**Configuration**:

- Bot personality and behavior rules
- Engagement strategy parameters
- Sleep schedule and cadence rules
- Quality thresholds and content filters

## ⚡ Level 2: GameWorkers (Specialized Task Execution)

### **Worker Hierarchy & Priorities**

Workers are organized by **priority levels** and **specialization domains**:

#### **🔥 CRITICAL Priority Workers**

##### **MentionsWorker** - Real-Time Social Interactions

**Location**: `src/workers/mentions-worker.ts`

**Response Time**: < 5 minutes for mentions, immediate for DMs

**Core Functions**:

- `fetch_mentions` - Get recent mentions and DMs
- `analyze_intent` - Understand what the human wants
- `delegate_tasks` - Route requests to other workers
- `reply_to_mention` - Respond to human interactions
- `send_dm` - Private conversations when needed
- `track_conversation` - Maintain conversation context
- `escalate_to_human` - Flag for manual review

**Use Cases**:

1. `"@GlitchBot check out this tweet"` → Delegate to DiscoveryWorker
2. `"@GlitchBot what's your take on XYZ?"` → Generate thoughtful reply
3. `"DM: Help me understand this protocol"` → Educational conversation
4. Reply chains → Maintain conversation continuity

**Characteristics**:

- Event-driven (triggered by mentions/DMs)
- Human relationship building focus
- Intent recognition and routing
- Community management

#### **📈 HIGH Priority Workers**

##### **Timeline Worker** - Home Timeline + Quoting

**Location**: `src/workers/timeline-worker.ts`

**Core Functions**:

- `get_timeline` - Fetches home timeline content (excludes self)
- `get_timeline_with_suggestion` - Mixes in recent suggested tweets from mentions
- `quote_tweet` - Posts quote tweets with strict author username discipline and 1h cadence

**Characteristics**:

- Topic filtering (AI/crypto/software/tech only) enforced at worker description level
- Duplicate prevention via `engaged_quotes`
- Cadence enforcement via `cadence` table (1 hour)

**Response Time**: Cadence-driven (respects timing rules)

**Core Functions**:

- `query_content_pipeline` - Get curated content from discovery
- `check_cadence_rules` - Ensure timing compliance
- `generate_quote_tweet` - Create thoughtful quote with commentary
- `generate_reply` - Craft strategic replies to conversations
- `post_content` - Execute the actual posting
- `track_engagement` - Monitor performance of posted content
- `update_cadence_tracker` - Record timing for future checks
- `analyze_performance` - Learn from engagement metrics

**Quality Standards**:

- Content score > 15/20 for quotes
- Author relevance and follower count
- Topic alignment with bot's expertise
- Engagement potential assessment

**Cadence Rules**:

- 2-hour minimum gap between quote tweets
- 60-second minimum gap between replies (relaxed for mentions)
- Sleep window compliance (05:00-13:00 UTC)

#### **🔍 MEDIUM Priority Workers**

##### **DiscoveryWorker** - Content Discovery & Curation

**Location**: `src/workers/twitter/discovery-worker.ts`

**Response Time**: Background (interruptible for priority requests)

**Core Functions**:

- `search_tweets` - Find content by keywords and topics
- `fetch_timeline` - Monitor key accounts and influencers
- `fetch_trending` - Discover viral and trending content
- `score_content` - Evaluate content quality and relevance
- `cache_candidates` - Store promising content for engagement
- `cleanup_cache` - Remove stale or processed content
- `analyze_patterns` - Learn from successful content
- `priority_analysis` - Handle user-suggested content

**Discovery Sources**:

1. Keyword searches: DeFi, AI, Web3, GameFi terms
2. Account monitoring: Key influencers and thought leaders
3. Trending topics: Viral content in relevant spaces
4. User suggestions: Community-driven content curation
5. Reply chains: Valuable conversations to join

**Scoring Criteria**:

- Keyword relevance (DeFi, AI, innovation)
- Author authority (follower count, verification)
- Engagement metrics (likes, retweets, replies)
- Content quality (insight, originality, value)
- Timing and freshness

**Content Pipeline**:

```
Input → Discovery → Scoring → Filtering → Caching → Engagement
```

**Quality Thresholds**:

- Score 15+: High priority for quotes
- Score 10-14: Medium priority candidates
- Score 5-9: Low priority backup content
- Score <5: Filtered out

##### **CoordinationWorker** - Cross-Worker Communication

**Location**: `src/workers/system/coordination-worker.ts`

**Response Time**: Real-time (event-driven)

**Core Functions**:

- `route_worker_message` - Handle inter-worker communication
- `manage_resource_locks` - Coordinate shared resource access
- `resolve_conflicts` - Handle competing worker requests
- `delegate_tasks` - Route tasks between specialized workers
- `synchronize_state` - Ensure consistent system state
- `broadcast_events` - Notify all workers of important events
- `manage_priority_queue` - Handle worker task queues
- `coordinate_shutdown` - Graceful system shutdown

**Coordination Scenarios**:

1. **User Request Delegation**: `"@GlitchBot check this tweet"` → MentionsWorker → DiscoveryWorker
2. **Resource Conflict Resolution**: Multiple workers want same tweet → Arbitration
3. **Cross-Worker Task Flow**: DiscoveryWorker finds content → EngagementWorker posts quote
4. **System Event Broadcasting**: API limit reached → Notify all workers to throttle
5. **Priority Management**: Critical mention arrives → Interrupt lower-priority workers

**Message Types**:

- `TASK_DELEGATION` - Route specific tasks between workers
- `RESOURCE_REQUEST` - Request access to shared resources
- `CONFLICT_RESOLUTION` - Resolve competing worker requests
- `STATE_SYNC` - Synchronize shared state across workers
- `SYSTEM_EVENT` - Broadcast important system-wide events
- `PRIORITY_ESCALATION` - Handle urgent/critical requests

#### **📊 LOW Priority Workers**

##### **MonitoringWorker** - System Health & Performance

**Location**: `src/workers/system/monitoring-worker.ts`

**Response Time**: Background (15-30 min cycles)

**Core Functions**:

- `check_api_limits` - Monitor Twitter API rate limits
- `track_error_rates` - Monitor error frequencies and patterns
- `measure_response_times` - Track worker performance
- `check_database_health` - Monitor DB performance and size
- `generate_health_report` - Create system status summaries
- `alert_on_issues` - Notify of critical system problems
- `optimize_performance` - Suggest improvements
- `predict_capacity` - Forecast resource needs

**Monitoring Areas**:

1. API Health: Rate limits, response times, error rates
2. Database: Query performance, storage usage, connection health
3. Worker Performance: Execution times, success rates, queue depths
4. System Resources: Memory usage, CPU utilization
5. Engagement Metrics: Success rates, response quality

**Alert Thresholds**:

- API rate limit > 80%: Warning
- API rate limit > 95%: Critical
- Error rate > 5%: Investigation needed
- Error rate > 15%: Critical issue
- Response time > 30s: Performance issue
- DB size > 100MB: Cleanup recommended

##### **MaintenanceWorker** - Database Cleanup & System Maintenance

**Location**: `src/workers/system/maintenance-worker.ts`

**Response Time**: Daily (during sleep window)

**Core Functions**:

- `cleanup_old_tweets` - Remove processed/stale content from cache
- `archive_engagement_history` - Move old engagement data to archive
- `optimize_database` - Run vacuum, reindex, analyze
- `rotate_logs` - Archive old log files, manage disk space
- `update_statistics` - Refresh analytics and trending data
- `backup_critical_data` - Create system backups
- `clean_temp_files` - Remove temporary files
- `validate_data_integrity` - Check data consistency

**Maintenance Schedule**:

- **Daily** (during sleep window 2-6 AM):
  - Cleanup tweets older than 24 hours from candidate cache
  - Archive engagement records older than 30 days
  - Rotate log files and clean temp files
- **Weekly**:
  - Full database optimization (vacuum, reindex)
  - Deep analytics refresh and trending updates
  - System backup creation
- **Monthly**:
  - Archive engagement history older than 90 days
  - Deep system cleanup and optimization
  - Performance trend analysis

**Cleanup Rules**:

- Suggested tweets: Remove after 24 hours or if score < 5
- Engagement records: Archive after 30 days, delete after 1 year
- Error logs: Keep 30 days, archive up to 6 months
- Performance logs: Keep 7 days, archive up to 3 months
- Backup retention: Keep 7 daily, 4 weekly, 12 monthly

## 🔧 Level 3: GameFunctions (Atomic Actions)

### **Function Categories**

#### **Atomic Functions (Single-Purpose)**

Implemented locations:

- Mentions: `src/functions/mentions/*`
- Timeline/Quoting: `src/functions/timeline/*`

**Social/Twitter Functions**:

- `fetch_mentions` - Get recent mentions and DMs
- `search_tweets` - Search by keywords and hashtags
- `fetch_timeline` - Monitor specific accounts
- `post_tweet` - Execute Twitter posting
- `like_tweet` - Like interesting content
- `send_dm` - Send private messages

**Analytics Functions** (helpers present):

- `lib/ranking.ts` - Scoring utilities

**Utility Functions**:

- `check_cadence` - Verify timing compliance
- `validate_content` - Content guideline validation
- `manage_locks` - Resource reservation

#### **Workflow Functions (Multi-Step Processes)**

**Location**: `src/functions/workflows/`

**Quote Tweet Workflow**:

1. Check cadence rules (2h gap)
2. Query content pipeline for best candidate
3. Generate thoughtful commentary
4. Post quote tweet
5. Update tracking and cadence

**Reply Workflow**:

1. Check cadence rules (60s gap, relaxed for mentions)
2. Analyze conversation context
3. Generate contextually appropriate reply
4. Post reply
5. Update tracking and cadence

## 🔗 Global Coordination Layer

### **EngagementTracker**

**Location**: `src/persistence/global/engagement-tracker.ts`

**Purpose**: Prevents duplicate engagement across workers

**Key Functions**:

- `requestLock()` - Request exclusive access to content
- `releaseLock()` - Release lock after engagement
- `hasRecentEngagement()` - Check if content recently engaged
- `getEngagementStats()` - System-wide engagement metrics

**Engagement Lock Types**:

- `quote` - Quote tweet engagement
- `reply` - Reply engagement
- `like` - Like engagement
- `analysis` - Content analysis lock

### **ReservationManager** (placeholder)

**Location**: `src/persistence/global/reservation-manager.ts`

**Purpose**: Manages shared resource access

**Resource Types**:

- `content` - High-quality content for engagement
- `api_quota` - Twitter API rate limit quotas
- `db_connection` - Database connection pools
- `conversation` - Exclusive access to conversation threads

**Key Functions**:

- `reserveResource()` - Request resource reservation
- `releaseResource()` - Release resource
- `checkAvailability()` - Check resource availability
- `getUtilizationStats()` - Resource utilization metrics

### **RateLimiter**

**Location**: `src/persistence/global/rate-limiter.ts`

**Purpose**: Intelligent API usage distribution

**Rate Limit Windows**:

- `per_15min` - 15-minute rolling window
- `per_hour` - Hourly rolling window
- `per_day` - Daily rolling window

**Allocation Strategies**:

- **Fair Share**: Equal distribution among workers
- **Priority-Based**: Higher priority workers get more allocation
- **Predictive**: Forecast usage and pre-allocate

**Key Functions**:

- `canMakeRequest()` - Check if request allowed
- `recordUsage()` - Track API usage
- `getRemainingCapacity()` - Check available capacity
- `scheduleRequest()` - Find optimal execution time

## 🔄 Worker Coordination Patterns

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

### **System Event Broadcasting** (future)

```
MonitoringWorker: Detects API rate limit at 85%
     ↓
CoordinationWorker: Broadcasts system event to all workers
     ↓
All Workers: Adjust behavior (throttle, prioritize, etc.)
     ↓
System: Continues operating within limits
```

## 📊 Performance & Monitoring

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

### **Performance Optimization**

- Worker priority-based scheduling
- Resource reservation and conflict resolution
- Intelligent rate limiting and throttling
- Predictive capacity planning

## 🎯 Architecture Benefits

### **Scalability**

- Modular worker design allows easy addition of new capabilities
- Priority-based scheduling ensures critical tasks are handled first
- Resource coordination prevents bottlenecks and conflicts

### **Reliability**

- Comprehensive error handling and recovery mechanisms
- Health monitoring and alerting systems
- Graceful degradation under high load

### **Maintainability**

- Clear separation of concerns
- Well-documented interfaces and patterns
- Standardized communication protocols

### **Flexibility**

- Easy to modify worker behaviors and priorities
- Configurable quality thresholds and cadence rules
- Extensible function library for new capabilities

---

**This architecture provides a robust foundation for autonomous social media engagement with intelligent coordination, quality control, and operational excellence.**
