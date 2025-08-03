PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE engaged_tweets (
        tweet_id TEXT PRIMARY KEY,
        engaged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        action TEXT CHECK(action IN ('reply','quote','like')) NOT NULL
      );
CREATE TABLE cadence (
        key TEXT PRIMARY KEY,
        value TEXT
      );
CREATE TABLE rate_limits (
        endpoint TEXT NOT NULL,
        window_type TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        requests_used INTEGER DEFAULT 0,
        worker_usage TEXT DEFAULT '{}', twitter_reset_time INTEGER,
        PRIMARY KEY (endpoint, window_type, window_start)
      );
INSERT INTO rate_limits VALUES('get_user','per_15min',1754253900000,1,'{"mentions-worker":1}',NULL);
INSERT INTO rate_limits VALUES('get_user','per_hour',1754251200000,1,'{"mentions-worker":1}',NULL);
INSERT INTO rate_limits VALUES('get_user','per_day',1754179200000,1,'{"mentions-worker":1}',NULL);
INSERT INTO rate_limits VALUES('fetch_mentions','per_15min',1754253900000,1,'{"mentions-worker":1}',0);
INSERT INTO rate_limits VALUES('fetch_mentions','per_hour',1754251200000,1,'{"mentions-worker":1}',0);
INSERT INTO rate_limits VALUES('fetch_mentions','per_day',1754179200000,1,'{"mentions-worker":1}',0);
CREATE TABLE pending_mentions (
        mention_id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL,
        author_username TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),
        priority INTEGER DEFAULT 5,
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        intent_type TEXT,
        confidence REAL,
        original_fetch_id TEXT,
        worker_id TEXT
      );
INSERT INTO pending_mentions VALUES('1951792748329386305','1447428083305222146','cheloeth','@carlothinks Wow @glitchbot_ai','2025-08-02T23:50:28.000Z','2025-08-03 20:48:08',NULL,'pending',5,0,NULL,NULL,NULL,'1951792748329386305',NULL);
INSERT INTO pending_mentions VALUES('1951792508851376550','1447428083305222146','cheloeth','@sama Scary, right @glitchbot_ai ?','2025-08-02T23:49:31.000Z','2025-08-03 20:48:08',NULL,'pending',5,0,NULL,NULL,NULL,'1951792748329386305',NULL);
INSERT INTO pending_mentions VALUES('1951791788584288280','1447428083305222146','cheloeth','@elonmusk @grok @glitchbot_ai what do you think ?','2025-08-02T23:46:39.000Z','2025-08-03 20:48:08',NULL,'pending',5,0,NULL,NULL,NULL,'1951792748329386305',NULL);
INSERT INTO pending_mentions VALUES('1940483298163413002','1753898487920398336','dragonkittdefi','@AjayKum73161762 @glitchbot_ai @lemoncheli @lemoncheli could answer better but he just ignoring me 🤣','2025-07-02T18:50:45.000Z','2025-08-03 20:48:08',NULL,'pending',5,0,NULL,NULL,NULL,'1951792748329386305',NULL);
INSERT INTO pending_mentions VALUES('1940481629602156779','838072669295771649','AjayKum73161762','@dragonkittdefi @glitchbot_ai @lemoncheli Any update on this','2025-07-02T18:44:07.000Z','2025-08-03 20:48:08',NULL,'pending',5,0,NULL,NULL,NULL,'1951792748329386305',NULL);
INSERT INTO pending_mentions VALUES('1939733597357056461','1753898487920398336','dragonkittdefi',replace('NEW ATH COMING on  @glitchbot_ai is looking good @lemoncheli LEGEND in the house buy and hold 🦾\n\nhttps://t.co/MwTheoumUB https://t.co/c0rJhqpwmv','\n',char(10)),'2025-06-30T17:11:42.000Z','2025-08-03 20:48:08',NULL,'pending',5,0,NULL,NULL,NULL,'1951792748329386305',NULL);
INSERT INTO pending_mentions VALUES('1939522957639885308','1753898487920398336','dragonkittdefi',replace('Dont fade @glitchbot_ai buy and hold. \n\nhttps://t.co/zfwA5nNJ3n','\n',char(10)),'2025-06-30T03:14:42.000Z','2025-08-03 20:48:08',NULL,'pending',5,0,NULL,NULL,NULL,'1951792748329386305',NULL);
INSERT INTO pending_mentions VALUES('1938242428588138731','1927899319467954176','MumtazeK9465',replace('🔥 The BIGGЕST #Сryрtо #РUMР is here! \n\n🚀 Jоin the actiоn! ➡️ https://t.co/ZXqT3Gcylh $ETH \n\no8dqM @raj_malhotra70 @glitchbot_ai @EzeCampraa @SerraglioDott @diggy_shank @MyNameIsTony666 @Hesam30526423 @UrielAssomo @Gerstrasorier @EmmanuelKi73964 @ShivamR75925410','\n',char(10)),'2025-06-26T14:26:20.000Z','2025-08-03 20:48:08',NULL,'pending',5,0,NULL,NULL,NULL,'1951792748329386305',NULL);
INSERT INTO pending_mentions VALUES('1937996170560774223','1449300308333522951','Motilal90506473',replace('🔥 The BIGGЕST #Сryрtо #РUMР is here! \n\n🚀 Jоin the actiоn! ➡️ https://t.co/zP8qXfZTcI $ETH \n\nqXLQu @MackenzieK29522 @KizitoFd @aljoo016 @HelenMitch36275 @glitchbot_ai @ak_ak59123939 @lucianssolution @KaiChowdhury @GingerScienceHQ @yanita_naura @merveyigit1989','\n',char(10)),'2025-06-25T22:07:47.000Z','2025-08-03 20:48:08',NULL,'pending',5,0,NULL,NULL,NULL,'1951792748329386305',NULL);
INSERT INTO pending_mentions VALUES('1937274299145928737','1487155499812507648','whoHambo',replace('https://t.co/aCkt3QsJwG\nSitting at 50k extremely undervalued and cooking  check out @glitchbot_ai and who the dev is \n\nOwner of the largest crypto app in South America @lemonapp_ar','\n',char(10)),'2025-06-23T22:19:20.000Z','2025-08-03 20:48:08',NULL,'pending',5,2,'Twitter API error: Request failed with code 400',NULL,NULL,'1951792748329386305',NULL);
CREATE TABLE mention_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
INSERT INTO mention_state VALUES('last_since_id','1951792748329386305','2025-08-03T20:48:08.059Z');
INSERT INTO mention_state VALUES('last_fetch_time','2025-08-03T20:48:08.059Z','2025-08-03T20:48:08.059Z');
CREATE INDEX idx_engaged_at ON engaged_tweets(engaged_at);
CREATE INDEX idx_rate_limits_window 
        ON rate_limits(endpoint, window_type, window_start);
CREATE INDEX idx_rate_limits_reset
        ON rate_limits(endpoint, window_type, twitter_reset_time);
CREATE INDEX idx_pending_status_priority ON pending_mentions(status, priority, created_at);
CREATE INDEX idx_pending_author ON pending_mentions(author_id);
COMMIT;
