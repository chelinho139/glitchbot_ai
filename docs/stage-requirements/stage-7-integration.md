# Stage 7 – Integration

**Run loop (every 60s):**

1) **Mentions Reply Loop** (fast path)
   - If not sleeping and ≥60s since last reply:
     - Pull mentions (or search fallback)
     - For each unseen: compose → reply → record engaged
2) **Quote-Tweet Loop** (slow path)
   - If not sleeping and `canQuoteNow()`:
     - Fetch home timeline or aggregated candidates
     - Score → pick best → quote → record engaged & timestamp

**Errors & Backoff**
- On 429 or repeated 5xx:
  - Exponential backoff with jitter on the failing path.
  - After multiple consecutive failures, send a DM to `@lemoncheli` and pause the quote loop ~30 minutes.
