import type { SystemDesign } from './types';

export const twitter: SystemDesign = {
  slug: 'twitter',
  name: 'Twitter / X',
  tagline: 'Real-time global public conversation with fan-out at scale',
  category: 'social',
  tags: ['social', 'timeline', 'fan-out', 'real-time', 'search', 'trending'],
  overview: `Twitter (now X) is a real-time microblogging platform where users post short messages (tweets) that are distributed to their followers' timelines. The core technical challenge is the fan-out problem: when a user with millions of followers tweets, that tweet must appear in millions of timelines within seconds. Twitter processes over 500 million tweets per day and serves billions of timeline requests.`,
  scale: {
    'Monthly active users': '550M+',
    'Tweets per day': '500M+',
    'Timeline requests/sec': '~300K',
    'Data storage': 'Petabytes',
  },
  requirements: {
    functional: [
      'Post tweets (text, images, video, polls)',
      'Home timeline (algorithmic + chronological)',
      'Retweets, likes, replies, and bookmarks',
      'Real-time trending topics',
      'Full-text tweet search',
      'Direct messages',
      'Follow/follower social graph',
    ],
    nonFunctional: [
      'Sub-second timeline delivery',
      'Handle viral tweet fan-out (celebrity problem)',
      'Real-time search indexing',
      'High write throughput for peak events',
      'Global availability',
      'Support for real-time event spikes',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        MOB[Mobile Apps]
        WEB[Web Client]
        API3[API Clients]
    end
    subgraph Edge
        LB[Load Balancer]
        CDN[CDN]
    end
    subgraph Services["Core Services"]
        TW[Tweet Service]
        TL[Timeline Service]
        FO[Fan-Out Service]
        SG[Social Graph]
        SR[Search Service]
        TR[Trending Service]
    end
    subgraph Cache["Caching Layer"]
        TMC[(Timeline Cache)]
        TC[(Tweet Cache)]
        UC[(User Cache)]
    end
    subgraph Storage["Storage"]
        MH[(Manhattan KV)]
        ES[(Earlybird Index)]
        BL[(Blob Store)]
    end
    subgraph Stream["Stream Processing"]
        KF[(Kafka)]
        HP[Heron]
    end
    MOB & WEB & API3 --> LB
    LB --> TW & TL & SR & TR
    TW --> FO
    FO --> TMC
    FO --> KF
    TL --> TMC & TC & UC
    SR --> ES
    TR --> HP
    TW --> MH
    KF --> HP`,
  components: [
    { name: 'Tweet Service', description: 'Handles tweet creation, storage, and retrieval. Persists tweets to Manhattan (distributed KV store) and triggers the fan-out pipeline.' },
    { name: 'Fan-Out Service', description: 'When a tweet is published, pushes the tweet ID into Redis timeline caches of all followers. Uses different strategies for high and low follower-count users.' },
    { name: 'Timeline Service', description: 'Assembles a user\'s home timeline by reading from pre-computed timeline cache (Redis) and hydrating tweet objects. Applies ranking algorithms for the algorithmic feed.' },
    { name: 'Social Graph Service', description: 'Manages the follow/follower graph using FlockDB. Supports queries like "who follows X" and "does A follow B" at massive scale.' },
    { name: 'Search (Earlybird)', description: 'Real-time search engine that indexes tweets within seconds of posting. Built on a custom inverted index optimized for recency-biased queries.' },
    { name: 'Trending Service', description: 'Analyzes the real-time tweet stream using Heron to detect emerging topics. Distinguishes trends from sustained high-volume topics.' },
  ],
  dataModel: `erDiagram
    USER {
        bigint user_id PK
        string username UK
        string display_name
        int followers_count
        int following_count
        boolean is_verified
    }
    TWEET {
        bigint tweet_id PK
        bigint user_id FK
        string text
        bigint reply_to_id
        int like_count
        int retweet_count
    }
    TIMELINE_ENTRY {
        bigint user_id FK
        bigint tweet_id FK
        float score
    }
    FOLLOW {
        bigint follower_id FK
        bigint followee_id FK
    }
    USER ||--o{ TWEET : posts
    USER ||--o{ FOLLOW : follows
    USER ||--o{ TIMELINE_ENTRY : has
    TWEET ||--o{ TIMELINE_ENTRY : appears_in`,
  deepDive: [
    {
      title: 'The Fan-Out Problem',
      content: `The fan-out problem is Twitter's defining architectural challenge.\n\n**Fan-Out-on-Write (Push):**\n- When a tweet is posted, push the tweet ID to every follower's timeline cache\n- Each user's timeline is a Redis sorted set of (tweet_id, timestamp)\n- Timeline cache holds ~800 most recent tweet IDs\n- **Used for**: Users with < ~50K followers\n\n**Fan-Out-on-Read (Pull):**\n- For celebrity users (130M+ followers), fan-out-on-write is prohibitive\n- Their tweets are fetched at read-time and merged with the pre-computed timeline\n- **Used for**: Users with > ~50K followers\n\n**The Math:**\n- Average user: ~200 followers → 200 Redis writes per tweet\n- Celebrity with 50M followers → 50M writes per tweet (200GB at 4KB each!)\n- The hybrid approach is essential\n\n**Timeline Assembly:**\n1. Read pre-computed timeline from Redis (pushed tweets)\n2. Fetch recent tweets from followed celebrities (pulled tweets)\n3. Merge by timestamp\n4. Apply ML ranking for "For You" tab\n5. Hydrate tweet objects\n6. Return final timeline`,
      diagram: `graph LR
    subgraph Write["Tweet by @alice - 500 followers"]
        T1[New Tweet] --> FOS[Fan-Out Service]
        FOS --> R1[Timeline: @bob]
        FOS --> R2[Timeline: @carol]
        FOS --> RN[Timeline: +498 more]
    end
    subgraph Read["@bob opens Home"]
        RC[Redis Cache] --> MRG[Merge + Rank]
        CEL[Celebrity tweets] --> MRG
        MRG --> HYD[Hydrate]
        HYD --> FINAL[Final Timeline]
    end`,
    },
    {
      title: 'Real-Time Search with Earlybird',
      content: `Twitter's search engine, **Earlybird**, is designed for real-time search — indexing tweets within seconds.\n\n**Architecture:**\n- Tweets flow through Kafka into Earlybird indexer instances\n- Each instance maintains an **in-memory inverted index** for recent tweets\n- Older tweets stored in on-disk index segments\n- Queries fanned out to all index partitions and results merged\n\n**Index Design:**\n- **Inverted index**: Maps terms to posting lists (tweet IDs)\n- **Real-time segment**: New tweets in a mutable in-memory segment\n- **Optimized segments**: Periodically flushed to read-only segments\n- **Recency ranking**: Results biased toward recent tweets\n\n**Query Processing:**\n1. Parse query into tokens with operators (AND, OR, from:, filter:)\n2. Fan out to all Earlybird partitions\n3. Each partition returns top-K local results\n4. Merge, deduplicate, and globally rank\n5. Social signals (likes, retweets) boost relevance\n\nEarlybird indexes tweets and makes them searchable in **under 10 seconds**.`,
    },
    {
      title: 'Trending Topics Detection',
      content: `Trending topics are detected in real-time from the global tweet stream.\n\n**Pipeline:**\n1. All tweets flow through Kafka into the stream processing layer\n2. **Heron** processes the stream (successor to Storm)\n3. Hashtags, keywords, and phrases are extracted and counted in sliding windows\n4. Algorithm distinguishes **trends** (sudden spikes) from **sustained volume**\n\n**Trend Detection Algorithm:**\n- Maintains baseline expected volume for each term (hourly, daily, weekly patterns)\n- Detects when current volume **significantly exceeds** the baseline\n- Uses statistical tests (z-score) to determine significance\n- Filters spam, adult content, and manipulation attempts\n\n**Personalization:**\n- Trends are localized by geography and language\n- "Trends for you" incorporates user interests and social graph\n- Each user may see different trending topics\n\nThe system processes ~6K tweets/second average (150K+ during peaks) with sub-minute trend detection latency.`,
    },
  ],
  tradeoffs: [
    {
      decision: 'Hybrid fan-out (push + pull)',
      pros: ['Avoids 50M+ writes for celebrity tweets', 'Fast timeline reads for most users', 'Balances write amplification'],
      cons: ['Complex merge logic', 'Celebrity tweet latency is higher', 'Two code paths to maintain'],
    },
    {
      decision: 'Redis for timeline caching',
      pros: ['Sub-millisecond read latency', 'Sorted sets are perfect for timelines', 'Simple and battle-tested'],
      cons: ['Memory-intensive at Twitter scale', 'Data loss risk on failures', 'Cost of billions of sorted sets'],
    },
    {
      decision: 'Custom search engine (Earlybird)',
      pros: ['Optimized for real-time indexing', 'Recency-biased ranking built-in', 'Fine-grained control over index lifecycle'],
      cons: ['Huge engineering investment', 'Maintenance burden', 'No community contributions'],
    },
  ],
};
