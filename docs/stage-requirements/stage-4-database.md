# Stage 4: Database Implementation

## Goal

Implement SQLite database with proper schema and create memory functions (`storeMemory`, `fetchMemory`) for the G.A.M.E engine.

## Requirements

### 1. Database Schema

- [ ] Create `engaged_tweets` table for tracking interactions
- [ ] Create `cadence` table for timing controls
- [ ] Create `candidate_tweets` table for backlog
- [ ] Implement proper indexes and constraints

### 2. Database Tables

#### engaged_tweets

```sql
CREATE TABLE engaged_tweets (
  tweet_id TEXT PRIMARY KEY,
  engaged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  action TEXT CHECK(action IN ('reply','quote','like')) NOT NULL,
  author_username TEXT,
  tweet_text TEXT
);
```

#### cadence

```sql
CREATE TABLE cadence (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### candidate_tweets

```sql
CREATE TABLE candidate_tweets (
  tweet_id TEXT PRIMARY KEY,
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  score REAL NOT NULL,
  reason TEXT,
  author_username TEXT,
  tweet_text TEXT
);
```

### 3. Database Operations

- [ ] Initialize database connection
- [ ] Create tables if they don't exist
- [ ] Implement CRUD operations
- [ ] Add proper error handling

### 4. Memory Functions

- [ ] Create `storeMemory` GameFunction
- [ ] Create `fetchMemory` GameFunction
- [ ] Support JSON serialization
- [ ] Handle key-value storage

### 5. Database Methods

```typescript
class GlitchBotDB {
  // Core operations
  init(): Promise<void>;
  close(): void;

  // Engagement tracking
  hasEngaged(tweetId: string): Promise<boolean>;
  recordEngagement(
    tweetId: string,
    action: string,
    author?: string,
    text?: string
  ): Promise<void>;

  // Cadence control
  getCadenceValue(key: string): Promise<string | null>;
  setCadenceValue(key: string, value: string): Promise<void>;

  // Candidate management
  addCandidate(
    tweetId: string,
    score: number,
    reason: string,
    author?: string,
    text?: string
  ): Promise<void>;
  getBestCandidate(): Promise<any | null>;
  removeCandidate(tweetId: string): Promise<void>;

  // Statistics
  getStats(): Promise<any>;
}
```

## Testing Criteria

### ✅ Success Criteria

- [ ] Database can be initialized
- [ ] Tables are created correctly
- [ ] CRUD operations work
- [ ] Memory functions work with G.A.M.E engine
- [ ] Data persistence works across restarts

### 🧪 Test Commands

```bash
# Test database operations
npm run test-db

# Test memory functions
npm run test-memory

# Test database schema
npm run test-schema
```

### 📋 Test Requirements

The database test should:

- [ ] Initialize database
- [ ] Create all tables
- [ ] Test engagement tracking
- [ ] Test cadence controls
- [ ] Test candidate management
- [ ] Test memory functions
- [ ] Verify data persistence

## Deliverables

- ✅ SQLite database implementation
- ✅ Database schema with all tables
- ✅ `storeMemory` GameFunction
- ✅ `fetchMemory` GameFunction
- ✅ Database operations class
- ✅ Test scripts for database functionality

## Implementation Details

### Database Connection

```typescript
import Database from "better-sqlite3";

const db = new Database("glitchbot.db");
db.pragma("journal_mode = WAL");
```

### Memory Functions

```typescript
const storeMemory = new GameFunction({
  name: "storeMemory",
  description: "Store data in persistent memory",
  args: [
    { name: "key", description: "Key to store the value under" },
    { name: "value", description: "Value to store (will be JSON serialized)" },
  ] as const,
  executable: async (args, logger) => {
    // Implementation here
  },
});
```

### Key-Value Storage

- [ ] Support string values
- [ ] Support JSON serialization
- [ ] Handle complex data types
- [ ] Provide data validation

## Notes

- Use WAL mode for better concurrency
- Implement proper error handling
- Add database migrations if needed
- Consider data cleanup strategies
- Test with real data persistence

## Next Stage

After completing Stage 4, proceed to [Stage 5: Quote Tweet Functionality](stage-5-quote-tweets.md)
