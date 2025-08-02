# 🔥 MentionsWorker - Real-Time Social Interactions

**Priority**: CRITICAL  
**Response Time**: < 5 minutes for mentions, immediate for DMs  
**Location**: `src/workers/twitter/mentions-worker.ts`

## 🎯 Purpose & Responsibilities

The **MentionsWorker** is the frontline interface between GlitchBot and the Twitter community. It handles all real-time social interactions, ensuring responsive and meaningful engagement with users.

### **Core Mission**

- Provide immediate, helpful responses to mentions and DMs
- Build and maintain community relationships
- Route complex requests to specialized workers
- Maintain conversation context and continuity

## ⚡ Characteristics

### **Priority Level**: CRITICAL

- **Response Time**: < 5 minutes for mentions, immediate for DMs
- **Triggers**: mentions, DMs, tags, replies_to_bot
- **Personality**: friendly, helpful, engaged
- **Conflicts**: None - always available for human interaction

### **Operational Behavior**

- **Event-driven**: Responds immediately to social interactions
- **Human-focused**: Prioritizes relationship building over automation
- **Context-aware**: Maintains conversation threads and history
- **Delegation-capable**: Routes complex requests to specialized workers

## 🔧 Core Functions

### **1. `fetch_mentions`** - Get Recent Interactions

**Type**: Atomic Function  
**Purpose**: Retrieve recent mentions and DMs from Twitter API

**Parameters**:

- `since_id`: Only fetch tweets after this ID to avoid duplicates
- `max_results`: Maximum number of mentions to fetch (default: 50)

**Returns**: Array of mention/DM objects with metadata

### **2. `analyze_intent`** - Understand User Intent

**Type**: Atomic Function  
**Purpose**: Parse and classify what the user wants

**Intent Categories**:

- `content_suggestion` - "Check out this tweet"
- `question` - "What do you think about X?"
- `conversation` - General chat or discussion
- `help_request` - "Can you help me understand Y?"
- `escalation` - Requires human intervention

**Returns**: Intent classification with confidence score

### **3. `delegate_tasks`** - Route to Specialized Workers

**Type**: Coordination Function  
**Purpose**: Send requests to appropriate workers via CoordinationWorker

**Delegation Patterns**:

- Content analysis → DiscoveryWorker
- Technical questions → EngagementWorker (for thoughtful replies)
- System issues → MonitoringWorker
- Complex requests → Multiple workers

### **4. `reply_to_mention`** - Respond to Interactions

**Type**: Atomic Function  
**Purpose**: Send public replies to mentions

**Response Types**:

- **Immediate acknowledgment**: "Thanks! I'll take a look at that"
- **Thoughtful reply**: Detailed response to questions
- **Delegation notice**: "Let me analyze this and get back to you"
- **Error handling**: "I'm having trouble with that right now"

### **5. `send_dm`** - Private Conversations

**Type**: Atomic Function  
**Purpose**: Send direct messages for private or sensitive interactions

**Use Cases**:

- Error notifications to owner
- Private help requests
- Sensitive content discussions
- System status updates

### **6. `track_conversation`** - Maintain Context

**Type**: Workflow Function  
**Purpose**: Track conversation threads and maintain context

**Context Tracking**:

- Conversation history
- User preferences and patterns
- Previous interactions
- Relationship building metrics

### **7. `escalate_to_human`** - Flag for Manual Review

**Type**: Workflow Function  
**Purpose**: Identify situations requiring human intervention

**Escalation Triggers**:

- Controversial or sensitive topics
- Complex technical questions
- User complaints or issues
- System errors or failures

## 🎭 Use Case Scenarios

### **Scenario 1: Content Suggestion**

```
User: "@GlitchBot check out this amazing DeFi protocol: [tweet_link]"

MentionsWorker Response:
1. Immediate: "Thanks! I'll take a look at that DeFi protocol 👀"
2. Delegate: Send priority analysis request to DiscoveryWorker
3. Follow-up: Report analysis results back to user
```

### **Scenario 2: Technical Question**

```
User: "@GlitchBot what's your take on the new AI agent frameworks?"

MentionsWorker Response:
1. Analyze: Classify as technical question
2. Generate: Create thoughtful, informed response
3. Post: Share insights on AI agent frameworks
4. Track: Record interaction for relationship building
```

### **Scenario 3: Conversation Thread**

```
User: "@GlitchBot that's interesting, but what about the security implications?"

MentionsWorker Response:
1. Context: Retrieve previous conversation context
2. Analyze: Understand follow-up question
3. Generate: Contextual response about security
4. Maintain: Continue conversation thread
```

### **Scenario 4: Error Handling**

```
User: "@GlitchBot why aren't you responding to my mentions?"

MentionsWorker Response:
1. Diagnose: Check system status and recent activity
2. Acknowledge: "I apologize for the delay! Let me check what happened"
3. Investigate: Query MonitoringWorker for system issues
4. Escalate: If needed, notify owner via DM
```

## 🔄 Cross-Worker Coordination

### **Delegation to DiscoveryWorker**

```typescript
// When user suggests content for analysis
await this.delegateToDiscovery({
  action: "priority_analysis",
  tweet_id: suggestedTweetId,
  requested_by: mention.author.username,
  mention_id: mention.id,
  urgency: "high",
});
```

### **Coordination with EngagementWorker**

```typescript
// For complex technical discussions
await this.delegateToEngagement({
  action: "generate_thoughtful_reply",
  context: conversationThread,
  user_question: mention.text,
  priority: "high",
});
```

### **System Monitoring Integration**

```typescript
// When system issues are detected
await this.escalateToMonitoring({
  issue_type: "response_delay",
  user_affected: mention.author.username,
  severity: "medium",
});
```

## 📊 Performance Metrics

### **Response Time Tracking**

- **Target**: < 5 minutes for mentions, immediate for DMs
- **Measurement**: Time from mention to first response
- **Alerting**: > 10 minutes triggers escalation

### **Engagement Quality**

- **User satisfaction**: Track follow-up interactions
- **Conversation depth**: Number of exchanges per thread
- **Relationship building**: User return rate and engagement

### **Delegation Effectiveness**

- **Task routing accuracy**: Correct worker selection
- **Response quality**: Quality of delegated responses
- **User satisfaction**: Feedback on delegated interactions

## 🛡️ Error Handling

### **API Failures**

- **Retry logic**: Exponential backoff for temporary failures
- **Graceful degradation**: Continue with cached data if needed
- **User notification**: Inform users of temporary issues

### **System Overload**

- **Priority queuing**: Critical mentions get priority
- **Load shedding**: Defer non-critical interactions
- **Escalation**: Notify owner of high load situations

### **Content Issues**

- **Sensitivity detection**: Flag controversial content
- **Escalation**: Route sensitive topics to human review
- **User guidance**: Help users understand bot limitations

## 🔧 Configuration

### **Response Templates**

```typescript
const RESPONSE_TEMPLATES = {
  content_suggestion: "Thanks! I'll take a look at that {topic} 👀",
  technical_question: "Great question about {topic}! Here's my take...",
  conversation: "That's an interesting point about {topic}...",
  error_apology: "I apologize for the delay! Let me check what happened.",
};
```

### **Escalation Rules**

```typescript
const ESCALATION_TRIGGERS = {
  controversial_topics: ["politics", "religion", "personal_attacks"],
  technical_complexity: ["advanced_programming", "system_architecture"],
  user_complaints: ["not_responding", "wrong_answers", "rude_behavior"],
};
```

### **Delegation Priorities**

```typescript
const DELEGATION_PRIORITIES = {
  content_analysis: "high",
  technical_questions: "medium",
  general_chat: "low",
  system_issues: "critical",
};
```

## 🎯 Success Criteria

### **Immediate Goals**

- **Response time**: < 5 minutes for 95% of mentions
- **User satisfaction**: Positive sentiment in 90% of interactions
- **Delegation accuracy**: 95% correct worker routing

### **Long-term Goals**

- **Community building**: Growing user engagement and relationships
- **Brand reputation**: Positive perception of helpful, intelligent bot
- **Operational efficiency**: Reduced manual intervention needs

---

**The MentionsWorker is the human face of GlitchBot, ensuring every interaction is meaningful, helpful, and builds lasting community relationships.**
