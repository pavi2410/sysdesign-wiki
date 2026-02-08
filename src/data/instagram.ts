import type { SystemDesign } from './types';

export const instagram: SystemDesign = {
  slug: 'instagram',
  name: 'Instagram',
  tagline: 'Photo and video sharing at massive scale with real-time feeds',
  category: 'social',
  tags: ['social', 'feeds', 'media', 'python', 'django', 'cassandra'],
  overview: `Instagram is one of the world's largest social media platforms, serving over 2 billion monthly active users. Its architecture handles the challenge of generating personalized feeds from billions of posts, processing massive volumes of image and video uploads, and delivering real-time interactions. Originally built as a Django monolith by a team of 3, it has evolved into a sophisticated microservices architecture within the Meta infrastructure.`,
  scale: {
    'Monthly active users': '2B+',
    'Photos uploaded daily': '~100M',
    'Likes per second': '~1M',
    'Media storage': 'Exabytes',
  },
  requirements: {
    functional: [
      'Photo and video upload with filters',
      'Personalized news feed (algorithmic + chronological)',
      'Stories (ephemeral 24-hour content)',
      'Direct messaging',
      'Explore/discovery page',
      'Likes, comments, and sharing',
      'User profiles and following system',
    ],
    nonFunctional: [
      'Sub-second feed generation',
      'Low-latency media delivery globally via CDN',
      'High availability (99.99%)',
      'Eventual consistency for social graph',
      'Support for viral content spikes',
      'Efficient storage of billions of images',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        A[iOS App]
        B[Android App]
        C[Web App]
    end
    subgraph Edge["Edge / CDN"]
        CDN[CDN]
        LB[Load Balancer]
    end
    subgraph API["API Layer"]
        GQL[GraphQL Gateway]
    end
    subgraph Services["Microservices"]
        FS[Feed Service]
        US[User Service]
        MS[Media Service]
        SS[Story Service]
        NS[Notification Service]
        RS[Recommendation]
    end
    subgraph Data["Data Layer"]
        PG[(PostgreSQL)]
        CS[(Cassandra)]
        MC[(Memcached)]
        RD[(Redis)]
        S3[(Object Storage)]
    end
    A & B & C --> CDN
    A & B & C --> LB
    LB --> GQL
    GQL --> FS & US & MS & SS
    FS --> CS & MC & RD
    US --> PG & MC
    MS --> S3 & CS
    NS --> RD
    FS --> RS`,
  components: [
    { name: 'Feed Service', description: 'Generates personalized feeds using a hybrid push/pull model. Pre-computes feeds for active users (fanout-on-write) and computes on-demand for inactive users (fanout-on-read).' },
    { name: 'Media Service', description: 'Handles image and video upload, processing (filters, resizing, transcoding), and storage. Generates multiple resolutions for different device sizes.' },
    { name: 'User Service', description: 'Manages user profiles, the social graph (follow/unfollow), and authentication. The social graph uses a TAO-based system for efficient traversal.' },
    { name: 'Story Service', description: 'Manages ephemeral content with 24-hour TTL. Uses a separate storage pipeline optimized for write-heavy, short-lived data.' },
    { name: 'Recommendation Service', description: 'Powers the Explore page and suggested follows using collaborative filtering and deep learning models trained on user interaction data.' },
    { name: 'Search Service', description: 'Full-text search across users, hashtags, and locations using Elasticsearch with custom analyzers for multilingual support.' },
  ],
  dataModel: `erDiagram
    USER {
        bigint user_id PK
        string username UK
        string bio
        int follower_count
        int following_count
    }
    POST {
        bigint post_id PK
        bigint user_id FK
        string caption
        enum type
        int like_count
        int comment_count
    }
    MEDIA {
        bigint media_id PK
        bigint post_id FK
        string url
        enum media_type
    }
    FOLLOW {
        bigint follower_id FK
        bigint following_id FK
    }
    USER ||--o{ POST : creates
    POST ||--o{ MEDIA : contains
    USER ||--o{ FOLLOW : follows
    POST ||--o{ COMMENT : has`,
  deepDive: [
    {
      title: 'Feed Generation Architecture',
      content: `Instagram uses a **hybrid fanout model** for feed generation, combining push and pull strategies:\n\n**Fanout-on-Write (Push Model):**\nWhen a user publishes a post, the Feed Service pushes the post ID into the feed caches of all followers. This pre-computes feeds, enabling instant feed loading.\n- Used for users with **< 10K followers**\n- Feed stored in Redis sorted sets (post_id, timestamp)\n- Each user's feed cache holds ~500 most recent post IDs\n\n**Fanout-on-Read (Pull Model):**\nFor celebrity accounts with millions of followers, fanout-on-write is too expensive. Instead, their posts are fetched on-demand when a follower loads their feed.\n- Used for users with **> 10K followers**\n- Merged with pre-computed feed at read time\n\n**Ranking:** Once candidate posts are assembled, an ML ranking model scores each post based on ~1000 features (user affinity, content type, timeliness, engagement signals) and returns the final ordered feed.`,
      diagram: `graph TB
    subgraph Write["Post Published"]
        P[New Post] --> FC{Follower Count}
        FC -->|under 10K| FW[Fanout on Write]
        FC -->|over 10K| STORE[Store Post Only]
        FW --> R1[Cache User 1]
        FW --> R2[Cache User 2]
        FW --> RN[Cache User N]
    end
    subgraph Read["Feed Request"]
        REQ[User Opens App] --> MERGE[Merge Engine]
        R1 --> MERGE
        STORE --> FR[Fanout on Read]
        FR --> MERGE
        MERGE --> RANK[ML Ranking]
        RANK --> FEED[Personalized Feed]
    end`,
    },
    {
      title: 'Media Processing Pipeline',
      content: `Every photo uploaded to Instagram goes through a sophisticated processing pipeline:\n\n1. **Upload**: Client uploads the original image to a staging area\n2. **Validation**: File format, size, and content policy checks\n3. **Processing**: Apply user-selected filters using GPU-accelerated pipelines\n4. **Resizing**: Generate multiple resolutions (thumbnail 150px, low 320px, medium 640px, high 1080px)\n5. **CDN Distribution**: Push processed images to edge locations worldwide\n6. **Metadata Extraction**: EXIF data, location, and computer vision (object detection, alt-text)\n\nFor **videos**, the pipeline also includes transcoding to multiple bitrates for adaptive streaming, generating preview thumbnails, and audio normalization.\n\nInstagram stores images in a custom storage system built on top of **Haystack** (Meta's photo storage), which reduces metadata overhead by storing multiple images in a single physical file.`,
    },
    {
      title: 'Social Graph with TAO',
      content: `Instagram uses Meta's **TAO (The Associations and Objects)** system for the social graph — a distributed, highly-cached graph data store.\n\n**TAO Architecture:**\n- **Objects**: Nodes in the graph (users, posts, comments)\n- **Associations**: Edges between nodes (follows, likes, comments-on)\n- **Caching Layer**: Multi-tier cache (L1 per-region, L2 per-datacenter) with >99% hit rate\n- **Storage**: MySQL sharded by object ID as the persistent backend\n\n**Query Pattern**: TAO optimizes for the most common social queries:\n- "Who does User X follow?" — Forward association query\n- "Who follows User X?" — Inverse association query\n- "Does User X follow User Y?" — Point association query\n\nThe cache handles billions of queries per second with median latency under 1ms.`,
    },
  ],
  tradeoffs: [
    {
      decision: 'Hybrid fanout (push + pull)',
      pros: ['Fast feed loading for most users', 'Avoids write storms for celebrities', 'Balances read/write costs'],
      cons: ['Complex merging logic at read time', 'Feed staleness for pull-based posts', 'Two code paths to maintain'],
    },
    {
      decision: 'Django monolith evolved to microservices',
      pros: ['Rapid initial development', 'Gradual migration possible', 'Python ecosystem for ML integration'],
      cons: ['GIL limits concurrency', 'Large monolith is hard to deploy', 'Migration to microservices is costly'],
    },
    {
      decision: 'Cassandra for feed storage',
      pros: ['Excellent write throughput', 'Linear horizontal scaling', 'Tunable consistency'],
      cons: ['No complex queries', 'Eventual consistency can show stale data', 'Operational complexity'],
    },
  ],
};
