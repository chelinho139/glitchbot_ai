# Stage 4 – Database (SQLite)

Schema (suggested):

```sql
CREATE TABLE IF NOT EXISTS engaged_tweets (
  tweet_id TEXT PRIMARY KEY,
  engaged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  action TEXT CHECK(action IN ('reply','quote','like')) NOT NULL
);

CREATE TABLE IF NOT EXISTS cadence (
  key TEXT PRIMARY KEY,    -- 'last_quote_ts', 'last_reply_ts'
  value TEXT               -- ISO8601 timestamp
);

CREATE TABLE IF NOT EXISTS candidate_tweets (
  tweet_id TEXT PRIMARY KEY,
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  score REAL NOT NULL,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_engaged_at ON engaged_tweets(engaged_at);
CREATE INDEX IF NOT EXISTS idx_candidate_score ON candidate_tweets(score DESC);
```
