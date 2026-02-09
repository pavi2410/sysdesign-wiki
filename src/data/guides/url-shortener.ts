import type { FeatureGuide } from './types';

export const urlShortener: FeatureGuide = {
  slug: 'url-shortener',
  title: 'URL Shortener',
  tagline: 'Short link generation, redirect resolution, and click analytics at scale',
  category: 'data',
  tags: ['URL', 'shortener', 'redirect', 'analytics', 'hashing'],
  problem: `URL shorteners transform long URLs into compact links (e.g., bit.ly/abc123) for sharing on social media, SMS, and print materials. Beyond basic shortening, production systems need custom short codes, branded domains, click analytics (who clicked, when, where), link expiration, and abuse prevention. The redirect service must handle millions of lookups per second with sub-10ms latency — every millisecond of redirect delay degrades user experience. The system must also prevent abuse (phishing, malware distribution) and scale the analytics pipeline to process billions of click events.`,
  approaches: [
    {
      name: 'Base62 Encoding of Auto-Increment ID',
      description: `Generate a unique integer ID (auto-increment counter or distributed ID generator) and encode it in Base62 (a-z, A-Z, 0-9) to produce a short alphanumeric code. ID 1000000 → "4c92". Simple, deterministic, and guaranteed unique.`,
      pros: [
        'Guaranteed unique — no collision checking needed',
        'Compact codes — 6 characters support 56 billion URLs',
        'Deterministic — same ID always produces same code',
        'Sortable — codes are roughly time-ordered',
      ],
      cons: [
        'Sequential codes are predictable — users can enumerate URLs',
        'Requires a centralized or distributed counter',
        'Short codes for early IDs (1 → "1") may look odd',
        'No customization — codes are assigned, not chosen',
      ],
    },
    {
      name: 'Random Short Code with Collision Check',
      description: `Generate a random alphanumeric string of fixed length (6-8 characters). Check if it already exists in the database. If collision, regenerate. Simple and unpredictable, but requires collision checking.`,
      pros: [
        'Unpredictable — can\'t enumerate or guess URLs',
        'No centralized counter needed',
        'Works in distributed systems without coordination',
        'Easy to implement',
      ],
      cons: [
        'Collision probability increases as the namespace fills up',
        'Must check for existence on every generation (database lookup)',
        'Slightly longer codes needed to keep collision rate low',
        'Not deterministic — same URL may get different codes',
      ],
    },
    {
      name: 'Hash-Based with Truncation',
      description: `Hash the original URL (MD5, SHA-256) and take the first N characters (or Base62 encode the first N bytes). Same URL always produces the same short code (deduplication). Collision handling via appending a counter.`,
      pros: [
        'Same URL always gets the same short code (deduplication)',
        'No centralized counter needed',
        'Deterministic — good for caching and idempotency',
        'Works well in distributed systems',
      ],
      cons: [
        'Hash truncation increases collision probability',
        'Must handle collisions (different URLs, same truncated hash)',
        'Cannot support custom short codes',
        'Hash computation adds minor overhead',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Clients
        WEB[Web App]
        API_CLIENT[API Client]
    end
    subgraph Create["URL Creation"]
        CREATE_API[Create API]
        GEN[Code Generator]
        VALIDATE[URL Validator<br/>& Abuse Check]
    end
    subgraph Redirect["Redirect Service"]
        REDIR[Redirect Handler<br/>301/302]
        CACHE[(Redis Cache<br/>Hot URLs)]
    end
    subgraph Storage
        DB[(URL Database<br/>PostgreSQL)]
        ANALYTICS_Q[Click Event<br/>Queue]
    end
    subgraph Analytics["Analytics Pipeline"]
        PROC[Event Processor]
        ANALYTICS_DB[(Click Analytics<br/>ClickHouse)]
        DASH[Analytics<br/>Dashboard]
    end
    WEB & API_CLIENT --> CREATE_API
    CREATE_API --> VALIDATE
    CREATE_API --> GEN
    GEN --> DB
    WEB & API_CLIENT -->|GET /abc123| REDIR
    REDIR --> CACHE
    CACHE -->|Miss| DB
    REDIR --> ANALYTICS_Q
    ANALYTICS_Q --> PROC
    PROC --> ANALYTICS_DB
    ANALYTICS_DB --> DASH`,
  components: [
    { name: 'Code Generator', description: 'Generates unique short codes using Base62 encoding, random generation, or hashing. Supports custom codes (user-chosen vanity URLs) with uniqueness validation. Ensures codes don\'t contain offensive words (filter list). Target: 6-8 characters for a balance of brevity and namespace size.' },
    { name: 'Redirect Handler', description: 'The hot path — resolves short codes to original URLs and returns an HTTP redirect (301 for permanent, 302 for temporary/trackable). Must be extremely fast (<5ms). Checks Redis cache first, falls back to database. Emits a click event asynchronously for analytics.' },
    { name: 'URL Validator & Abuse Prevention', description: 'Validates that the target URL is well-formed and not malicious. Checks against phishing/malware databases (Google Safe Browsing API). Rate limits URL creation per user/IP. Blocks known abuse patterns (URL chains, redirect loops).' },
    { name: 'Click Analytics Pipeline', description: 'Captures every redirect as a click event: timestamp, short code, referrer, user agent, IP (for geolocation), and device type. Events are queued (Kafka/SQS) and processed into an analytics database (ClickHouse) for real-time dashboards showing clicks over time, geographic distribution, and top referrers.' },
    { name: 'Redis Cache Layer', description: 'Caches the most frequently accessed short code → URL mappings. LRU eviction policy. Hit rate target: 90%+ (most redirects are for popular/recent links). Cache-aside pattern: on miss, fetch from DB and populate cache with TTL.' },
    { name: 'Analytics Dashboard', description: 'Per-link analytics: total clicks, clicks over time (hourly/daily), geographic breakdown, device/browser breakdown, top referrers, and unique visitors. Supports date range filtering and CSV export. Powers the "link performance" view for users.' },
  ],
  dataModel: `erDiagram
    SHORT_URL {
        string code PK
        string original_url
        string user_id FK
        string custom_domain
        timestamp expires_at
        boolean active
        int click_count
        timestamp created_at
    }
    CLICK_EVENT {
        string event_id PK
        string code FK
        string referrer
        string user_agent
        string ip_address
        string country
        string city
        string device_type
        string browser
        timestamp clicked_at
    }
    URL_DOMAIN {
        string domain_id PK
        string user_id FK
        string domain
        enum status
        timestamp created_at
    }
    SHORT_URL ||--o{ CLICK_EVENT : tracks
    URL_DOMAIN ||--o{ SHORT_URL : hosts`,
  deepDive: [
    {
      title: 'Short Code Generation Strategy',
      content: `A 6-character Base62 code supports 62^6 = **56.8 billion** unique URLs. A 7-character code supports 3.5 trillion. For most applications, 6 characters is sufficient.\n\n**Base62 encoding of distributed ID**:\n1. Generate a unique 64-bit ID using Snowflake, ULID, or a database sequence\n2. Encode in Base62: repeatedly divide by 62 and map remainders to characters\n3. Pad to minimum length (6 characters)\n\n**Avoiding predictability**: If using sequential IDs, add a shuffle step. XOR the ID with a secret key before Base62 encoding. This makes codes appear random while remaining deterministic and reversible.\n\n**Custom short codes**: Users can request vanity URLs (e.g., /launch-2024). Validate: minimum 4 characters, alphanumeric + hyphens, not in the reserved words list, not already taken. Store custom codes in the same table with a flag.\n\n**Collision handling for random codes**: With 6-character random codes and 1 billion existing URLs, collision probability per generation is ~1.8%. Use a retry loop (generate, check, retry if exists). After 3 collisions, increase code length by 1 character. In practice, collisions are rare and retries are fast.\n\n**Reserved codes**: Block codes that conflict with your routes: /api, /login, /admin, /health. Also block offensive words using a filter list.`,
    },
    {
      title: '301 vs 302 Redirects',
      content: `The HTTP redirect status code has significant implications.\n\n**301 Moved Permanently**:\n- Browser caches the redirect — subsequent visits don't hit your server\n- Better for SEO — passes link equity to the target URL\n- Click analytics are incomplete — cached redirects are invisible\n- Use for: permanent links where SEO matters and analytics don't\n\n**302 Found (Temporary Redirect)**:\n- Browser does NOT cache — every visit hits your server\n- Every click is tracked in your analytics\n- Slightly higher latency (extra server round-trip)\n- Use for: links where click tracking is important (most URL shorteners)\n\n**307/308**: Preserve the HTTP method (POST stays POST). Rarely needed for URL shorteners.\n\n**Most URL shorteners use 301** for simplicity and SEO, accepting that some clicks won't be tracked. **Analytics-focused shorteners use 302** to capture every click.\n\n**Hybrid approach**: Use 301 for the initial redirect but embed a tracking pixel or JavaScript redirect on the landing page for analytics. This gives SEO benefits of 301 while still capturing some analytics data.\n\n**Performance**: The redirect handler must respond in <10ms. Any slower and users perceive a delay when clicking links. Cache hot URLs in Redis (0.1ms lookup) and use connection pooling for database fallback.`,
    },
    {
      title: 'Analytics at Scale',
      content: `A popular URL shortener processes billions of clicks per day. The analytics pipeline must handle this volume without impacting redirect latency.\n\n**Async event collection**: The redirect handler emits a click event to a queue (Kafka, SQS) and responds immediately. Never block the redirect on analytics processing. If the queue is unavailable, drop the event (redirect availability > analytics completeness).\n\n**Click event enrichment**: The event processor enriches raw events:\n- IP → geolocation (country, city) using MaxMind GeoIP\n- User-Agent → device type, browser, OS using ua-parser\n- Referrer → categorized source (social, search, direct, email)\n\n**Storage**: ClickHouse or TimescaleDB for time-series click data. Partition by date for efficient range queries. Pre-aggregate hourly/daily counts for dashboard performance. Keep raw events for 90 days, aggregated data for 2+ years.\n\n**Real-time counters**: For displaying live click counts, use Redis INCR on the short code key. Periodically flush to the database. This avoids hitting the analytics DB for simple count queries.\n\n**Unique visitor counting**: Use HyperLogLog (Redis PFADD) for approximate unique visitor counts. Memory-efficient (12KB per counter regardless of cardinality) and accurate to ~0.81% error. Good enough for analytics dashboards.\n\n**Bot filtering**: A significant portion of clicks are bots (crawlers, preview generators). Filter by user-agent patterns, known bot IP ranges, and behavioral signals (clicks within milliseconds of creation). Show "human clicks" and "total clicks" separately.`,
    },
  ],
  realWorldExamples: [
    { system: 'Bitly', approach: 'The most popular URL shortener. Base62-encoded IDs for short codes. Custom branded domains. Comprehensive click analytics with geographic and device breakdown. Enterprise features include team management, campaign tracking, and API access.' },
    { system: 'Dub.co', approach: 'Open-source URL shortener built with Next.js. Custom domains with automatic SSL. Click analytics with country, device, and referrer tracking. Edge-based redirect handling via Vercel Edge Functions for low latency. Free tier with generous limits.' },
    { system: 'TinyURL', approach: 'One of the original URL shorteners. Simple and reliable. Supports custom aliases. No analytics in the free tier. Demonstrates that even a basic implementation can scale to billions of redirects.' },
    { system: 'Twitter/X (t.co)', approach: 'Wraps all links in tweets with t.co short URLs. Used for click tracking, malware detection, and link preview generation. Every link click goes through t.co — processes hundreds of thousands of redirects per second. Also used to check links against spam/phishing databases in real-time.' },
  ],
  tradeoffs: [
    {
      decision: 'Base62 sequential ID vs random code generation',
      pros: ['Sequential: guaranteed unique, no collision checking', 'Random: unpredictable, no centralized counter needed', 'Sequential: shorter codes for early URLs'],
      cons: ['Sequential: predictable, requires centralized/distributed counter', 'Random: collision probability increases over time, requires existence check', 'Sequential: reveals creation order and total URL count'],
    },
    {
      decision: '301 (permanent) vs 302 (temporary) redirect',
      pros: ['301: cached by browser, better SEO, lower server load', '302: every click tracked, complete analytics', '301: faster for repeat visitors (no server round-trip)'],
      cons: ['301: missed analytics for cached redirects', '302: higher server load (every click hits your server)', '301: hard to change the target URL (browsers cache the old one)'],
    },
    {
      decision: 'Redis cache vs database-only for redirect lookup',
      pros: ['Redis: sub-millisecond lookups, handles millions of QPS', 'DB-only: simpler architecture, one source of truth', 'Redis: absorbs traffic spikes without database pressure'],
      cons: ['Redis: additional infrastructure, cache invalidation on URL updates', 'DB-only: higher latency (1-5ms), limited QPS per instance', 'Redis: memory cost for caching billions of URLs (but only hot ones needed)'],
    },
  ],
};
