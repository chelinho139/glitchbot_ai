# 🔗 Global Coordination Layer

The **Global Coordination Layer** provides system-wide coordination, resource management, and conflict resolution across all GlitchBot workers. This layer ensures efficient operation, prevents conflicts, and maintains system integrity.

## 🎯 Overview

The coordination layer consists of three core components that work together to manage shared resources, coordinate worker activities, and optimize system performance:

- **EngagementTracker**: Prevents duplicate engagement across workers
- **ReservationManager**: Manages shared resource access and allocation
- **RateLimiter**: Optimizes API usage distribution and scheduling

## 🔒 EngagementTracker

**Location**: `src/persistence/global/engagement-tracker.ts`

### Purpose & Responsibilities

The **EngagementTracker** prevents multiple workers from engaging with the same content simultaneously, ensuring efficient resource usage and preventing conflicts.

#### Core Mission

- Prevent duplicate engagement across workers
- Track engagement history and success patterns
- Coordinate system-wide engagement strategy
- Optimize engagement timing and frequency

### Key Functions

#### **`requestLock()`** - Exclusive Access Request

```typescript
async requestLock(
  tweet_id: string,
  worker_id: string,
  lock_type: 'quote' | 'reply' | 'like' | 'analysis',
  duration_minutes: number = 15
): Promise<boolean>
```

**Purpose**: Request exclusive access to engage with specific content

**Parameters**:

- `tweet_id`: Target tweet ID for engagement
- `worker_id`: Worker requesting the lock
- `lock_type`: Type of engagement (quote, reply, like, analysis)
- `duration_minutes`: Lock duration in minutes

**Returns**: Boolean indicating if lock was granted

**Lock Types**:

- **`quote`**: Quote tweet engagement
- **`reply`**: Reply engagement
- **`like`**: Like engagement
- **`analysis`**: Content analysis lock

#### **`releaseLock()`** - Lock Release

```typescript
async releaseLock(
  tweet_id: string,
  worker_id: string,
  success: boolean
): Promise<void>
```

**Purpose**: Release lock after engagement attempt and record results

**Parameters**:

- `tweet_id`: Tweet ID that was engaged with
- `worker_id`: Worker that held the lock
- `success`: Whether engagement was successful

#### **`hasRecentEngagement()`** - Engagement History Check

```typescript
async hasRecentEngagement(
  tweet_id: string,
  hours: number = 24
): Promise<boolean>
```

**Purpose**: Check if content has been engaged with recently

**Parameters**:

- `tweet_id`: Tweet ID to check
- `hours`: Time window to check (default: 24 hours)

**Returns**: Boolean indicating if recent engagement exists

#### **`getEngagementStats()`** - System-wide Statistics

```typescript
async getEngagementStats(hours: number = 24): Promise<{
  total_engagements: number;
  successful_engagements: number;
  quote_tweets: number;
  replies: number;
  likes: number;
  success_rate: number;
}>
```

**Purpose**: Get system-wide engagement statistics and metrics

### Engagement Lock Lifecycle

```
1. Worker requests lock → EngagementTracker
2. Check availability → Grant or deny lock
3. Worker performs engagement → Success/failure
4. Worker releases lock → Update history
5. Cleanup expired locks → Maintain efficiency
```

### Conflict Resolution

#### **Lock Conflicts**

When multiple workers want to engage with the same content:

1. **Priority-based**: Higher priority workers get preference
2. **First-come-first-served**: For equal priority requests
3. **Queue management**: Lower priority requests wait in queue
4. **Timeout handling**: Expired locks are automatically released

#### **Engagement Conflicts**

When content has been recently engaged with:

1. **Time-based filtering**: Respect minimum engagement intervals
2. **Quality-based decisions**: Higher quality content gets priority
3. **Worker coordination**: Coordinate between competing workers
4. **Escalation**: Route conflicts to CoordinationWorker if needed

## 🎫 ReservationManager

**Location**: `src/persistence/global/reservation-manager.ts`

### Purpose & Responsibilities

The **ReservationManager** manages shared resource access, ensuring fair distribution and preventing resource conflicts across all workers.

#### Core Mission

- Manage shared resource access and allocation
- Implement priority-based resource distribution
- Handle resource conflicts and queue management
- Optimize resource utilization across workers

### Resource Types

#### **Content Resources**

- **High-quality content**: Premium content for quote tweets
- **Reply opportunities**: Content for strategic replies
- **Analysis candidates**: Content for deep analysis
- **Trending content**: Viral content for engagement

#### **API Resources**

- **Rate limit quotas**: Twitter API usage allocation
- **Request quotas**: API request distribution
- **Endpoint access**: Specific API endpoint allocation
- **Priority access**: High-priority request allocation

#### **System Resources**

- **Database connections**: Connection pool management
- **Memory allocation**: Memory usage distribution
- **CPU time**: Processing time allocation
- **Storage space**: Disk space management

#### **Conversation Resources**

- **Thread access**: Exclusive access to conversation threads
- **Reply chains**: Reply sequence management
- **Discussion participation**: Conversation slot allocation
- **Community engagement**: Community interaction opportunities

### Key Functions

#### **`reserveResource()`** - Resource Reservation

```typescript
async reserveResource(
  resource_type: 'content' | 'api_quota' | 'db_connection' | 'conversation',
  resource_id: string,
  worker_id: string,
  priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  duration_minutes: number = 30
): Promise<ResourceReservation | null>
```

**Purpose**: Reserve a resource for exclusive use

**Parameters**:

- `resource_type`: Type of resource to reserve
- `resource_id`: Specific resource identifier
- `worker_id`: Worker requesting the resource
- `priority`: Request priority level
- `duration_minutes`: Reservation duration

**Returns**: ResourceReservation object or null if unavailable

#### **`releaseResource()`** - Resource Release

```typescript
async releaseResource(reservation_id: string): Promise<void>
```

**Purpose**: Release a reserved resource

**Parameters**:

- `reservation_id`: ID of the reservation to release

#### **`checkAvailability()`** - Resource Availability

```typescript
async checkAvailability(
  resource_type: ResourceReservation['resource_type'],
  resource_id?: string
): Promise<{
  available: boolean;
  queue_position?: number;
  estimated_wait_minutes?: number;
}>
```

**Purpose**: Check if a resource is available

**Returns**: Availability status with queue information

#### **`reserveAPIQuota()`** - API Quota Management

```typescript
async reserveAPIQuota(
  worker_id: string,
  operation_type: 'tweet' | 'search' | 'fetch',
  estimated_requests: number = 1
): Promise<boolean>
```

**Purpose**: Reserve API quota for worker operations

**Parameters**:

- `worker_id`: Worker requesting quota
- `operation_type`: Type of API operation
- `estimated_requests`: Number of requests needed

**Returns**: Boolean indicating if quota was reserved

### Resource Allocation Strategies

#### **Fair Share Allocation**

- **Equal distribution**: Equal resource allocation among workers
- **Proportional allocation**: Allocation based on worker needs
- **Dynamic adjustment**: Real-time allocation adjustments
- **Load balancing**: Distribute load across available resources

#### **Priority-based Allocation**

- **Critical priority**: Immediate access for urgent requests
- **High priority**: Preferred access for important requests
- **Medium priority**: Standard access for normal requests
- **Low priority**: Background access for non-urgent requests

#### **Queue Management**

- **Priority queues**: Separate queues for different priority levels
- **FIFO within priority**: First-in-first-out within same priority
- **Timeout handling**: Automatic queue timeout and cleanup
- **Escalation**: Priority escalation for long-waiting requests

### Resource Pool Management

#### **Pool Configuration**

```typescript
const RESOURCE_POOLS = {
  api_tweets: {
    total_capacity: 50, // tweets per hour
    available_capacity: 50,
    reserved_capacity: 0,
    waiting_queue: [],
  },
  api_requests: {
    total_capacity: 900, // requests per 15 min window
    available_capacity: 900,
    reserved_capacity: 0,
    waiting_queue: [],
  },
  content_pipeline: {
    total_capacity: 100, // content items
    available_capacity: 100,
    reserved_capacity: 0,
    waiting_queue: [],
  },
};
```

#### **Capacity Management**

- **Dynamic capacity**: Adjust capacity based on system load
- **Overflow handling**: Handle requests exceeding capacity
- **Recovery mechanisms**: Restore capacity after failures
- **Monitoring**: Track capacity utilization and trends

## ⏱️ RateLimiter

**Location**: `src/persistence/global/rate-limiter.ts`

### Purpose & Responsibilities

The **RateLimiter** coordinates API usage across all workers to prevent rate limiting and optimize API efficiency.

#### Core Mission

- Coordinate API usage distribution across workers
- Prevent Twitter API rate limiting
- Optimize API request scheduling
- Provide intelligent throttling and queuing

### Rate Limit Windows

#### **Time-based Windows**

- **`per_15min`**: 15-minute rolling window
- **`per_hour`**: Hourly rolling window
- **`per_day`**: Daily rolling window

#### **Endpoint-specific Limits**

```typescript
const RATE_LIMITS = {
  search_tweets: {
    requests_per_15min: 180,
    requests_per_hour: 720,
    requests_per_day: 17280,
    worker_fair_share: true,
  },
  post_tweet: {
    requests_per_15min: 50,
    requests_per_hour: 200,
    requests_per_day: 2400,
    worker_fair_share: false, // Priority-based allocation
  },
  fetch_mentions: {
    requests_per_15min: 75,
    requests_per_hour: 300,
    requests_per_day: 7200,
    worker_fair_share: true,
  },
};
```

### Key Functions

#### **`canMakeRequest()`** - Request Permission

```typescript
async canMakeRequest(
  endpoint: string,
  worker_id: string,
  priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<{
  allowed: boolean;
  retry_after_seconds?: number;
  reason?: string;
}>
```

**Purpose**: Check if API request is allowed under rate limits

**Parameters**:

- `endpoint`: API endpoint to check
- `worker_id`: Worker making the request
- `priority`: Request priority level

**Returns**: Permission status with retry timing

#### **`recordUsage()`** - Usage Tracking

```typescript
async recordUsage(
  endpoint: string,
  worker_id: string,
  success: boolean,
  response_headers?: Record<string, string>
): Promise<void>
```

**Purpose**: Record API request usage and update tracking

**Parameters**:

- `endpoint`: API endpoint used
- `worker_id`: Worker that made the request
- `success`: Whether request was successful
- `response_headers`: Rate limit headers from Twitter

#### **`getRemainingCapacity()`** - Capacity Check

```typescript
async getRemainingCapacity(endpoint: string): Promise<{
  per_15min: { remaining: number; resets_at: string };
  per_hour: { remaining: number; resets_at: string };
  per_day: { remaining: number; resets_at: string };
}>
```

**Purpose**: Get remaining API capacity for specific endpoint

#### **`scheduleRequest()`** - Optimal Scheduling

```typescript
async scheduleRequest(
  endpoint: string,
  worker_id: string,
  priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<{
  execute_at: string;
  estimated_delay_seconds: number;
}>
```

**Purpose**: Find optimal execution time for API request

**Returns**: Scheduled execution time and delay estimate

### Allocation Strategies

#### **Fair Share Allocation**

- **Equal distribution**: Equal API quota among workers
- **Proportional allocation**: Quota based on worker needs
- **Dynamic adjustment**: Real-time quota adjustments
- **Load balancing**: Distribute API load efficiently

#### **Priority-based Allocation**

- **Critical priority**: Immediate API access
- **High priority**: Preferred API access
- **Medium priority**: Standard API access
- **Low priority**: Background API access

#### **Predictive Scheduling**

- **Usage prediction**: Predict future API needs
- **Optimal timing**: Schedule requests at optimal times
- **Load distribution**: Spread requests across time windows
- **Efficiency optimization**: Maximize API usage efficiency

### Worker Fair Share

#### **Fair Share Calculation**

```typescript
async getWorkerAllocation(
  endpoint: string,
  worker_id: string
): Promise<{
  allocated_per_15min: number;
  allocated_per_hour: number;
  used_per_15min: number;
  used_per_hour: number;
  remaining_allocation: number;
}>
```

**Purpose**: Get worker's fair share allocation for API endpoint

**Allocation Factors**:

- **Active workers**: Number of currently active workers
- **Worker priorities**: Priority levels of different workers
- **Historical usage**: Past usage patterns and efficiency
- **Current load**: Current system load and demand

### System Status Monitoring

#### **Health Metrics**

```typescript
async getSystemStatus(): Promise<{
  [endpoint: string]: {
    health: 'healthy' | 'warning' | 'critical';
    utilization_percent: number;
    active_workers: number;
    requests_queued: number;
  };
}>
```

**Purpose**: Get system-wide rate limit status and health

**Health Levels**:

- **`healthy`**: Normal operation, <80% utilization
- **`warning`**: Approaching limits, 80-95% utilization
- **`critical`**: Near limits, >95% utilization

## 🔄 Coordination Patterns

### **Cross-Component Integration**

#### **Engagement + Reservation**

```typescript
// Request engagement lock and API quota
const lockGranted = await engagementTracker.requestLock(
  tweet_id,
  worker_id,
  "quote"
);
const quotaReserved = await reservationManager.reserveAPIQuota(
  worker_id,
  "tweet",
  1
);

if (lockGranted && quotaReserved) {
  // Proceed with quote tweet
  await performQuoteTweet(tweet_id);
  await engagementTracker.releaseLock(tweet_id, worker_id, true);
  await reservationManager.releaseResource(quotaReservationId);
}
```

#### **Rate Limiting + Scheduling**

```typescript
// Check rate limits and schedule request
const canRequest = await rateLimiter.canMakeRequest(
  "post_tweet",
  worker_id,
  "high"
);

if (canRequest.allowed) {
  // Execute immediately
  await postTweet(tweet);
} else {
  // Schedule for optimal time
  const schedule = await rateLimiter.scheduleRequest(
    "post_tweet",
    worker_id,
    "high"
  );
  await scheduleTweet(tweet, schedule.execute_at);
}
```

### **Conflict Resolution**

#### **Resource Conflicts**

1. **Priority-based resolution**: Higher priority requests win
2. **Queue management**: Lower priority requests wait
3. **Timeout handling**: Automatic conflict resolution
4. **Escalation**: Route to CoordinationWorker if needed

#### **Timing Conflicts**

1. **Optimal scheduling**: Find best execution time
2. **Load distribution**: Spread requests across time
3. **Priority queuing**: Queue based on priority
4. **Dynamic adjustment**: Adjust based on system load

## 📊 Performance Metrics

### **Coordination Efficiency**

- **Lock acquisition time**: Time to acquire resource locks
- **Conflict resolution time**: Time to resolve conflicts
- **Queue wait times**: Time requests spend in queues
- **Resource utilization**: Efficiency of resource usage

### **API Optimization**

- **Rate limit efficiency**: Optimal use of API quotas
- **Request scheduling**: Quality of request timing
- **Error reduction**: Reduction in rate limit errors
- **Throughput optimization**: Maximum API throughput

### **System Health**

- **Resource availability**: Availability of shared resources
- **Conflict frequency**: Frequency of resource conflicts
- **Queue depths**: Depth of waiting queues
- **System responsiveness**: Overall system responsiveness

## 🛡️ Error Handling

### **Resource Exhaustion**

- **Graceful degradation**: Continue with reduced functionality
- **Priority preservation**: Maintain critical operations
- **Recovery mechanisms**: Automatic resource recovery
- **Alert systems**: Notify of resource issues

### **Rate Limit Violations**

- **Prevention**: Proactive rate limit management
- **Recovery**: Automatic recovery from violations
- **Backoff strategies**: Exponential backoff for retries
- **Escalation**: Alert on repeated violations

### **System Failures**

- **Fault tolerance**: Continue operation with failures
- **Data consistency**: Maintain data integrity
- **Recovery procedures**: Automatic system recovery
- **Monitoring**: Continuous system monitoring

---

**The Global Coordination Layer ensures GlitchBot operates efficiently, prevents conflicts, and maintains optimal performance across all workers and resources.**
