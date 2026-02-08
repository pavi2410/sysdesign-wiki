import type { SystemDesign } from './types';

export const netflix: SystemDesign = {
  slug: 'netflix',
  name: 'Netflix',
  tagline: 'Global video streaming with personalized content delivery',
  category: 'streaming',
  tags: ['streaming', 'video', 'CDN', 'microservices', 'recommendation'],
  overview: `Netflix is the world's leading streaming service with over 260 million paid subscribers in 190+ countries. Its architecture is a masterclass in cloud-native design, having pioneered many microservices and chaos engineering patterns. Netflix serves over 1 billion hours of video per week through its custom CDN (Open Connect), while its recommendation engine drives 80% of content watched.`,
  scale: {
    'Paid subscribers': '260M+',
    'Video streamed weekly': '1B+ hours',
    'API requests/second': '~500K',
    'Content encodings': 'Petabytes',
  },
  requirements: {
    functional: [
      'Video streaming with adaptive bitrate',
      'Personalized recommendations and search',
      'User profiles and viewing history',
      'Offline downloads',
      'Multiple concurrent streams per account',
      'Content browsing across genres',
    ],
    nonFunctional: [
      'Global low-latency video delivery',
      '99.99% availability',
      'Adaptive quality based on network conditions',
      'Support for 100+ device types',
      'Horizontal scalability for peak traffic',
      'Fault tolerance — no single point of failure',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        TV[Smart TV]
        MOB[Mobile]
        WEB[Browser]
    end
    subgraph Edge["Content Delivery"]
        OCA[Open Connect Appliances]
    end
    subgraph AWS["AWS Backend"]
        AG[API Gateway - Zuul]
        PS[Playback Service]
        RS[Recommendation]
        US[User Service]
        CS[Content Service]
        BS[Billing Service]
    end
    subgraph Data
        EVS[(EVCache)]
        CAS[(Cassandra)]
        S3[(S3)]
        KF[(Kafka)]
    end
    subgraph Pipeline["Content Pipeline"]
        ENC[Encoding Pipeline]
        QC[Quality Control]
    end
    TV & MOB & WEB --> OCA
    TV & MOB & WEB --> AG
    AG --> PS & RS & US & CS & BS
    PS --> EVS & CAS
    RS --> CAS & EVS
    CS --> S3
    PS --> OCA
    ENC --> QC --> S3 --> OCA`,
  components: [
    { name: 'API Gateway (Zuul)', description: 'Edge service handling request routing, authentication, rate limiting, and load shedding. Processes billions of requests per day with dynamic routing rules.' },
    { name: 'Open Connect CDN', description: 'Netflix\'s custom CDN with thousands of appliances embedded in ISP networks worldwide. Serves 95%+ of video traffic, reducing internet backbone load.' },
    { name: 'Playback Service', description: 'Determines the optimal video stream for each client based on device capabilities, network conditions, and DRM requirements.' },
    { name: 'Recommendation Service', description: 'ML-powered personalization using collaborative filtering, content-based filtering, and deep learning. Powers 80% of what users watch.' },
    { name: 'Encoding Pipeline', description: 'Transcodes each title into 100+ encodings (resolution, bitrate, codec) using per-title and per-shot optimization for quality-efficient streaming.' },
    { name: 'EVCache', description: 'Distributed caching layer (built on Memcached), handling 30M+ requests/second with sub-millisecond latency for session, profile, and recommendation data.' },
  ],
  dataModel: `erDiagram
    MEMBER {
        bigint member_id PK
        string email
        string plan_type
    }
    PROFILE {
        bigint profile_id PK
        bigint member_id FK
        string name
        string maturity_level
    }
    TITLE {
        bigint title_id PK
        string name
        enum type
        int release_year
        string genres
    }
    ENCODING {
        bigint encoding_id PK
        bigint title_id FK
        string resolution
        int bitrate_kbps
        string codec
    }
    VIEWING_HISTORY {
        bigint profile_id FK
        bigint title_id FK
        int progress_seconds
        boolean completed
    }
    MEMBER ||--o{ PROFILE : has
    PROFILE ||--o{ VIEWING_HISTORY : records
    TITLE ||--o{ VIEWING_HISTORY : watched_in
    TITLE ||--o{ ENCODING : encoded_as`,
  deepDive: [
    {
      title: 'Open Connect CDN Architecture',
      content: `Netflix's **Open Connect** is one of the largest CDNs in the world, purpose-built for video delivery.\n\n**How it works:**\n- Netflix places custom server appliances (OCAs) **inside ISP networks** worldwide\n- During off-peak hours, new content is proactively **pushed** to OCAs based on predicted demand\n- When a user presses play, they're directed to the **closest OCA** that has the content\n\n**OCA Specifications:**\n- Custom-built servers with 100+ TB SSD storage\n- Optimized FreeBSD-based OS with custom TCP stack\n- Single OCA can serve 100+ Gbps of video\n- ~18,000 OCAs in 6,000+ locations worldwide\n\n**Content Placement Algorithm:**\n- Predicts what content will be popular in each region\n- Fills OCAs during off-peak hours (typically 2am-8am local time)\n- Popular content replicated across more OCAs for redundancy\n\n**95% of Netflix traffic never crosses the internet backbone**, reducing costs and improving quality.`,
      diagram: `graph TB
    subgraph Netflix["Netflix Backend"]
        CP[Content Pipeline]
        CTRL[OCA Control Plane]
        STEER[Steering Service]
    end
    subgraph ISP1["ISP Network A"]
        OCA1[OCA Server 1]
        OCA2[OCA Server 2]
    end
    subgraph ISP2["ISP Network B"]
        OCA3[OCA Server 3]
    end
    U1[User A]
    U2[User B]
    CP -->|Off-peak fill| OCA1 & OCA2 & OCA3
    CTRL -->|Health monitoring| OCA1 & OCA2 & OCA3
    U1 -->|1. Request| STEER
    STEER -->|2. Best OCA| U1
    U1 -->|3. Stream| OCA1
    U2 -->|Stream| OCA3`,
    },
    {
      title: 'Adaptive Bitrate Streaming',
      content: `Netflix uses adaptive bitrate (ABR) streaming to deliver the best quality for each user's network conditions.\n\n**Per-Title Encoding:**\nInstead of fixed encoding ladders, Netflix analyzes each title's visual complexity and creates a **custom encoding ladder**:\n- Simple animation might look perfect at 1.5 Mbps in 1080p\n- An action movie might need 8 Mbps for the same resolution\n- Saves 20% bandwidth on average while maintaining quality\n\n**Per-Shot Encoding:**\n- Static dialogue scenes get lower bitrates\n- Fast-action sequences get higher bitrates\n- Smooth transitions between quality levels\n\n**Client-Side ABR Algorithm:**\n1. Maintains a ~30-second playback buffer\n2. Measures download speed of recent segments\n3. Selects the highest sustainable quality\n4. Upgrades/downgrades smoothly between segments\n\nNetflix encodes each title into **~120 different streams** (resolution, bitrate, codec, HDR combinations).`,
    },
    {
      title: 'Chaos Engineering & Resilience',
      content: `Netflix pioneered **chaos engineering** — intentionally introducing failures to build system resilience.\n\n**Key Tools:**\n- **Chaos Monkey**: Randomly terminates production instances\n- **Chaos Kong**: Simulates entire AWS region failure\n- **Latency Monkey**: Introduces artificial delays\n\n**Resilience Patterns:**\n- **Circuit Breakers**: Calls to failing services are short-circuited with fallbacks\n- **Bulkheads**: Thread pool isolation prevents cascade failures\n- **Fallbacks**: Every service has degraded-mode responses\n- **Retries with backoff**: Exponential backoff with jitter\n\nThe philosophy: "The best way to avoid failure is to fail constantly." By regularly testing failure scenarios in production, Netflix ensures graceful handling of real failures.`,
    },
  ],
  tradeoffs: [
    {
      decision: 'Custom CDN (Open Connect) vs. third-party CDN',
      pros: ['Full control over hardware/software stack', 'Massive cost savings at scale', '95%+ traffic served from ISP edge'],
      cons: ['Huge upfront infrastructure investment', 'Complex ISP relationships', 'Hardware logistics across 6000+ locations'],
    },
    {
      decision: 'Microservices architecture',
      pros: ['Independent deployability', 'Technology heterogeneity', 'Fault isolation between services'],
      cons: ['Distributed system complexity', 'Network latency between services', 'Harder debugging across boundaries'],
    },
    {
      decision: 'Per-title encoding over fixed ladders',
      pros: ['20% bandwidth savings', 'Better quality for simple content', 'Optimal experience per title'],
      cons: ['Much higher encoding compute cost', 'Longer content onboarding time', 'Complex encoding pipeline'],
    },
  ],
};
