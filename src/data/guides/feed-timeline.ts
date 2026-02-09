import type { FeatureGuide } from './types';

export const feedTimeline: FeatureGuide = {
  slug: 'feed-timeline',
  title: 'Feed & Timeline Generation',
  tagline: 'Fan-out-on-write vs fan-out-on-read strategies for personalized content feeds',
  category: 'data',
  tags: ['feed', 'timeline', 'fan-out', 'ranking', 'social'],
  problem: `Social platforms, news apps, and marketplace dashboards need to generate personalized feeds showing relevant content from followed users, topics, or sources. The core challenge: when a user opens their feed, you must quickly assemble a sorted, deduplicated, ranked list of items from potentially thousands of sources. At scale, this involves billions of content items and trillions of follow relationships. The feed must load in under 200ms, support infinite scroll pagination, and feel fresh — showing new content within seconds of creation.`,
  approaches: [
    {
      name: 'Fan-Out on Write (Push Model)',
      description: `When a user creates content, immediately "push" it to the feed inbox of every follower. Each user has a pre-computed feed stored in a sorted set (Redis) or timeline table. Reading the feed is a simple ordered read from the user's inbox — extremely fast.`,
      pros: [
        'Ultra-fast feed reads — just fetch from a pre-computed list',
        'Consistent read latency regardless of how many people you follow',
        'Simple pagination — cursor through the sorted set',
        'Feed is always ready when the user opens the app',
      ],
      cons: [
        'Write amplification — a celebrity with 10M followers requires 10M inbox writes',
        'High storage cost — content duplicated across millions of inboxes',
        'Delete/edit propagation is expensive (must update all inboxes)',
        'Wasted work for inactive users who may never read their feed',
      ],
    },
    {
      name: 'Fan-Out on Read (Pull Model)',
      description: `When a user requests their feed, query the content from all sources they follow at read time. Merge, sort, and rank results on the fly. No pre-computation — the feed is assembled fresh on every request.`,
      pros: [
        'No write amplification — posting is instant regardless of follower count',
        'Zero storage overhead — no duplicate content',
        'Deletes and edits are instantly reflected',
        'No wasted work for inactive users',
      ],
      cons: [
        'Slow feed reads — must query and merge from many sources',
        'Read latency scales with number of followed sources',
        'Complex query — merging sorted streams from hundreds of sources',
        'Hard to implement ranking without materializing the feed',
      ],
    },
    {
      name: 'Hybrid: Push for Normal Users, Pull for Celebrities',
      description: `Combine both approaches based on the author's follower count. Regular users (< 10K followers) use fan-out-on-write. High-follower accounts ("celebrities") skip the fan-out; their content is pulled at read time and merged with the pre-computed feed. This is the approach used by Twitter/X and Instagram.`,
      pros: [
        'Eliminates write amplification for high-follower accounts',
        'Fast reads for most content (pre-computed)',
        'Celebrity content is always fresh (pulled on read)',
        'Best balance of write and read performance',
      ],
      cons: [
        'Most complex implementation — two code paths',
        'Must maintain a threshold and classify users',
        'Celebrity content has slightly higher read latency',
        'Testing and debugging is harder with hybrid logic',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Writers["Content Creation"]
        U1[User Posts]
        CEL[Celebrity Posts]
    end
    subgraph FanOut["Fan-Out Service"]
        FW[Fan-Out Worker<br/>Push to inboxes]
        FF[Follow Graph<br/>Service]
    end
    subgraph FeedService["Feed Assembly"]
        FR[Feed Reader]
        RANK[Ranking<br/>Service]
        MERGE[Merger<br/>Push + Pull]
    end
    subgraph Storage
        INB[(User Inboxes<br/>Redis Sorted Sets)]
        CONTENT[(Content Store<br/>Database)]
        GRAPH[(Follow Graph<br/>Database)]
        CACHE[(Feed Cache)]
    end
    U1 --> FW
    FW --> FF
    FF --> GRAPH
    FW --> INB
    CEL --> CONTENT
    FR --> INB
    FR --> CONTENT
    FR --> MERGE
    MERGE --> RANK
    RANK --> CACHE`,
  components: [
    { name: 'Fan-Out Service', description: 'Consumes content creation events and writes to follower inboxes. Queries the follow graph to get the follower list, then batch-inserts the content ID into each follower\'s sorted set (scored by timestamp). Uses worker pools for parallelism. Skips fan-out for celebrity accounts.' },
    { name: 'Follow Graph Service', description: 'Manages follow/unfollow relationships and provides fast follower/following list queries. Stored in a graph database or adjacency list in PostgreSQL. Cached in Redis for frequent lookups. Must support bidirectional queries (who follows X, who does X follow).' },
    { name: 'Feed Reader', description: 'Assembles the user\'s feed by reading from their inbox (pre-computed items) and merging with pulled content from celebrity sources. Handles pagination via cursor-based scrolling (score-based in Redis sorted sets). Hydrates content IDs into full objects.' },
    { name: 'Ranking Service', description: 'Scores and sorts feed items based on relevance signals: recency, engagement (likes, comments, shares), author affinity (how often the user interacts with this author), content type preference, and diversity (don\'t show 5 posts from the same person in a row).' },
    { name: 'Content Store', description: 'Source of truth for all content (posts, photos, videos). Feed inboxes store only content IDs — the full content is fetched (and cached) when the feed is read. Supports batch fetching for efficient hydration.' },
    { name: 'Feed Cache', description: 'Caches assembled and ranked feeds for recently active users. Reduces computation on repeated feed loads (pull-to-refresh). Short TTL (30-60 seconds) ensures freshness. Invalidated when new content is pushed to the inbox.' },
  ],
  dataModel: `erDiagram
    USER {
        string user_id PK
        string username
        boolean is_celebrity
        int follower_count
    }
    FOLLOW {
        string follower_id FK
        string following_id FK
        timestamp created_at
    }
    CONTENT {
        string content_id PK
        string author_id FK
        string type
        string body
        json media
        int like_count
        int comment_count
        timestamp created_at
    }
    FEED_INBOX {
        string user_id FK
        string content_id FK
        float score
        boolean read
        timestamp inserted_at
    }
    USER ||--o{ FOLLOW : follows
    USER ||--o{ CONTENT : creates
    USER ||--o{ FEED_INBOX : has
    CONTENT ||--o{ FEED_INBOX : appears_in`,
  deepDive: [
    {
      title: 'Fan-Out Worker Design',
      content: `The fan-out worker is the workhorse of the push model. When a user with 100K followers posts, the worker must write to 100K inboxes quickly.\n\n**Architecture**:\n1. Content creation event arrives in a queue (Kafka/SQS)\n2. Worker fetches the author's follower list (paginated, 1000 at a time)\n3. For each batch of followers, pipeline ZADD commands to Redis: \`ZADD user:{follower_id}:inbox {timestamp} {content_id}\`\n4. Trim each inbox to the max size (e.g., keep latest 1000 items): \`ZREMRANGEBYRANK user:{follower_id}:inbox 0 -1001\`\n\n**Performance**: Redis ZADD is O(log N). With pipelining, a single worker can write ~50K inbox entries per second. For a 100K follower fan-out, this takes ~2 seconds with a single worker, or ~200ms with 10 parallel workers.\n\n**Backpressure**: During viral moments (celebrity posts), the fan-out queue can grow rapidly. Use priority queues — fan out to active users first (users who opened the app in the last 24 hours), then backfill inactive users in lower priority.\n\n**Failure handling**: If a fan-out partially fails, some followers will miss the content. Use idempotent writes (ZADD is naturally idempotent) and retry failed batches. A periodic reconciliation job can catch any drift.`,
    },
    {
      title: 'Feed Ranking Algorithms',
      content: `Chronological feeds are simple but don't maximize engagement. Most platforms use ranked feeds.\n\n**Ranking signals**:\n- **Recency**: Newer content scores higher. Exponential decay function: \`score = base_score * e^(-λ * age_hours)\`\n- **Engagement**: Content with more likes/comments/shares is boosted. Normalize by impression count to avoid bias toward older content.\n- **Affinity**: How closely connected is the viewer to the author? Signals: message frequency, profile visits, reaction history. "Interest graph" vs "social graph."\n- **Content type**: Users may prefer photos over text posts. Learn per-user preferences from interaction history.\n- **Diversity**: Penalize consecutive items from the same author or topic. Inject content from less-seen sources to avoid filter bubbles.\n\n**Simple scoring formula**:\n\`\`\`\nscore = w1 * recency_score + w2 * engagement_score + w3 * affinity_score + w4 * content_type_score - w5 * repetition_penalty\n\`\`\`\n\n**ML-based ranking**: At scale, train a model (gradient boosted trees, neural networks) to predict engagement probability. Features include all the above signals plus user-level features (activity level, account age, device type). Instagram and TikTok use deep learning models that consider hundreds of signals.`,
    },
    {
      title: 'Cursor-Based Pagination',
      content: `Feeds use cursor-based pagination instead of offset-based for consistency during infinite scroll.\n\n**Why not offset?**: With offset pagination (\`LIMIT 20 OFFSET 40\`), new content inserted at the top shifts all items down, causing duplicates or missed items as the user scrolls.\n\n**Cursor approach**: Each page response includes a cursor (the score/timestamp of the last item). The next request uses this cursor: "give me 20 items with score less than 1707100000." New items at the top don't affect the cursor position.\n\n**Implementation with Redis sorted sets**:\n- First page: \`ZREVRANGEBYSCORE user:inbox +inf -inf LIMIT 0 20\`\n- Next page: \`ZREVRANGEBYSCORE user:inbox ({last_score} -inf LIMIT 0 20\`\n\n**Opaque cursors**: Encode the cursor as a base64 string so clients can't manipulate it. Include the score, last item ID (for tie-breaking), and an HMAC signature to prevent tampering.\n\n**Gap detection**: If there's a large time gap between feed sessions, show a "catch-up" summary instead of scrolling through hundreds of items. "While you were away: 42 new posts from 15 people."`,
    },
  ],
  realWorldExamples: [
    { system: 'Twitter/X', approach: 'Hybrid fan-out model. Regular users fan-out on write to follower timelines stored in Redis. Celebrity accounts (high follower count) are pulled on read and merged. "For You" feed uses ML ranking on top of the chronological timeline.' },
    { system: 'Instagram', approach: 'Fan-out on write with ML-ranked feed. Posts are pushed to follower inboxes, then ranked by a deep learning model considering interest, timeliness, relationship, frequency, following count, and session time.' },
    { system: 'LinkedIn', approach: 'Fan-out on write with a "feed mixer" that blends content from connections, followed companies, and sponsored content. Uses a two-pass ranking: first pass scores all candidates, second pass optimizes for diversity and ad placement.' },
    { system: 'TikTok', approach: 'Almost entirely pull-based with ML ranking. The "For You" feed is not based on a follow graph — it\'s a recommendation engine that pulls from the entire content corpus and ranks by predicted watch time. This is why TikTok doesn\'t need you to follow anyone.' },
  ],
  tradeoffs: [
    {
      decision: 'Fan-out on write vs fan-out on read',
      pros: ['Write: fastest reads, simplest feed assembly', 'Read: no write amplification, instant deletes/edits', 'Hybrid: best of both, used by major platforms'],
      cons: ['Write: massive write amplification for popular accounts', 'Read: slow reads, complex query merging', 'Hybrid: most complex to build and operate'],
    },
    {
      decision: 'Chronological vs ranked feed',
      pros: ['Chronological: simple, predictable, no algorithm bias', 'Ranked: higher engagement, surfaces best content', 'Option toggle: let users choose (Twitter approach)'],
      cons: ['Chronological: important content buried under high-volume sources', 'Ranked: "filter bubble" effect, opaque to users', 'Both: double the complexity in feed assembly'],
    },
    {
      decision: 'Redis sorted sets vs Cassandra for feed storage',
      pros: ['Redis: lowest latency (<1ms), perfect sorted set operations', 'Cassandra: better for large feeds, cheaper storage per user', 'Redis: simpler operational model for moderate scale'],
      cons: ['Redis: memory-bound, expensive at billions of users', 'Cassandra: higher read latency (5-20ms), more complex queries', 'Redis: data loss risk without persistence (use Redis Cluster with AOF)'],
    },
  ],
};
