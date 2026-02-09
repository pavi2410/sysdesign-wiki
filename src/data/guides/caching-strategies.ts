import type { FeatureGuide } from './types';

export const cachingStrategies: FeatureGuide = {
  slug: 'caching-strategies',
  title: 'Caching Strategies',
  tagline: 'Cache-aside, write-through, invalidation patterns, and distributed caching with Redis',
  category: 'data',
  tags: ['caching', 'Redis', 'invalidation', 'performance', 'distributed'],
  problem: `Database queries are expensive — 5-50ms each, limited by connection pools, and contention under load. Caching stores frequently accessed data in fast in-memory stores (Redis, Memcached) to serve reads in <1ms. But caching introduces the hardest problem in computer science: cache invalidation. When does the cache become stale? How do you update it? What happens during cache failures? The wrong caching strategy can cause stale data bugs, thundering herds on cache misses, and inconsistency between cache and database that's impossible to debug.`,
  approaches: [
    {
      name: 'Cache-Aside (Lazy Loading)',
      description: `The application manages the cache explicitly. On read: check cache first, if miss then query the database and store the result in cache. On write: update the database and invalidate (delete) the cache entry. The next read re-populates the cache. The most common pattern.`,
      pros: [
        'Simple to implement — application has full control',
        'Only caches data that is actually requested (demand-driven)',
        'Cache failure is graceful — falls back to database',
        'Works with any cache backend (Redis, Memcached, local)',
      ],
      cons: [
        'First request after invalidation is slow (cache miss → DB query)',
        'Risk of stale data if invalidation fails',
        'Thundering herd: many requests hit the database on popular cache miss',
        'Requires careful TTL tuning per data type',
      ],
    },
    {
      name: 'Write-Through Cache',
      description: `Every write goes to both the cache and the database simultaneously. The cache is always up-to-date. Reads always hit the cache. Eliminates stale data at the cost of slower writes.`,
      pros: [
        'Cache is always consistent with the database',
        'No cache misses for recently written data',
        'Simpler mental model — cache mirrors the database',
      ],
      cons: [
        'Slower writes — must write to two systems',
        'Caches data that may never be read (wasteful)',
        'More complex failure handling — what if cache write succeeds but DB fails?',
        'Not suitable for high-write, low-read workloads',
      ],
    },
    {
      name: 'Write-Behind (Write-Back) Cache',
      description: `Writes go to the cache first and are asynchronously flushed to the database in batches. Provides the fastest write performance but risks data loss if the cache fails before flushing.`,
      pros: [
        'Fastest write performance — only memory write on hot path',
        'Batch writes to database improve throughput',
        'Absorbs write spikes without database pressure',
      ],
      cons: [
        'Risk of data loss — cached writes not yet flushed',
        'Complex consistency model — cache is ahead of database',
        'Database reads may return stale data',
        'Failure recovery is complex — must replay un-flushed writes',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph App["Application Layer"]
        API[API Server]
        CM[Cache Manager<br/>Middleware]
    end
    subgraph CacheLayer["Cache Layer"]
        L1[L1: In-Process<br/>LRU Cache]
        L2[L2: Redis Cluster<br/>Distributed Cache]
    end
    subgraph Database["Database Layer"]
        DB[(Primary DB)]
        READ[(Read Replica)]
    end
    subgraph Invalidation["Invalidation"]
        CDC[CDC / Events]
        INV[Invalidation<br/>Publisher]
    end
    API --> CM
    CM --> L1
    L1 -->|Miss| L2
    L2 -->|Miss| READ
    API -->|Write| DB
    DB --> CDC
    CDC --> INV
    INV -->|Invalidate| L2
    INV -->|Invalidate| L1`,
  components: [
    { name: 'Cache Manager', description: 'Middleware layer that intercepts data access calls and implements the chosen caching strategy (cache-aside, write-through, etc.). Handles cache key generation, serialization, TTL management, and error handling. Provides a unified API regardless of the underlying cache backend.' },
    { name: 'L1 In-Process Cache', description: 'Application-local LRU cache for the hottest data. Zero network latency. Limited by process memory (typically 100MB-1GB). Not shared across instances — each instance has its own L1. Best for immutable or rarely-changing data (configuration, feature flags).' },
    { name: 'L2 Distributed Cache (Redis)', description: 'Shared cache accessible by all application instances. Redis Cluster for high availability and horizontal scaling. Stores serialized objects with TTL. Supports rich data structures (hashes, sorted sets, sets) for complex caching patterns.' },
    { name: 'Cache Invalidation Publisher', description: 'Listens for data change events (via CDC, application events, or database triggers) and publishes cache invalidation messages. Ensures all cache layers (L1 across all instances + L2) are invalidated when source data changes.' },
    { name: 'Cache Warming Service', description: 'Pre-populates the cache with known hot data during startup or after a cache flush. Prevents the thundering herd problem on a cold cache. Runs as a background job that queries the database for frequently accessed records.' },
    { name: 'Cache Metrics Collector', description: 'Tracks hit rate, miss rate, eviction rate, latency, and memory usage per cache key prefix. Critical for tuning TTLs and identifying cache efficiency problems. Alert on hit rate drops below threshold (e.g., <80% indicates a problem).' },
  ],
  dataModel: `erDiagram
    CACHE_ENTRY {
        string cache_key PK
        bytes value
        int ttl_seconds
        timestamp created_at
        timestamp expires_at
        string source_table
        string source_id
    }
    CACHE_CONFIG {
        string key_prefix PK
        int default_ttl
        enum strategy
        boolean l1_enabled
        int max_size
    }
    CACHE_METRIC {
        string key_prefix
        int hits
        int misses
        int evictions
        float avg_latency_ms
        timestamp window_start
    }
    INVALIDATION_EVENT {
        string event_id PK
        string cache_key
        string source
        string reason
        timestamp created_at
    }
    CACHE_CONFIG ||--o{ CACHE_ENTRY : governs
    CACHE_ENTRY ||--o{ INVALIDATION_EVENT : invalidated_by
    CACHE_CONFIG ||--o{ CACHE_METRIC : tracked_by`,
  deepDive: [
    {
      title: 'Cache Invalidation Patterns',
      content: `"There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton\n\n**TTL-based expiry**: Set a time-to-live on every cache entry. After TTL expires, the next read triggers a cache miss and re-fetch. Simple but creates a staleness window equal to the TTL. Use shorter TTLs (30-60s) for frequently changing data, longer (5-60min) for stable data.\n\n**Event-driven invalidation**: When data changes, publish an event that triggers cache deletion. Most accurate but requires reliable event delivery. If the invalidation event is lost, the cache stays stale until TTL expires.\n\n**Version-based invalidation**: Include a version number in the cache key: \`user:123:v7\`. When data changes, increment the version. Old cache entries naturally expire via TTL. Never serves stale data but wastes cache space with old versions.\n\n**Tag-based invalidation**: Tag cache entries with categories. Invalidate all entries with a given tag. Example: tag all product-related caches with \`product:456\`. When product 456 changes, invalidate all entries tagged with it. Redis doesn't support this natively — implement with sets tracking keys per tag.\n\n**Stampede prevention**: When a popular cache entry expires, hundreds of requests simultaneously hit the database. Solutions:\n- **Lock-based**: First request acquires a lock, fetches from DB, populates cache. Others wait on the lock.\n- **Probabilistic early expiry**: Each request has a small chance of refreshing before TTL. Spreading refreshes over time.\n- **Background refresh**: A background worker refreshes popular entries before they expire.`,
    },
    {
      title: 'Multi-Layer Caching',
      content: `Production systems typically use multiple cache layers, each with different latency and capacity characteristics:\n\n**L1 — In-process cache** (0.001ms, 100MB):\n- Node.js: \`lru-cache\` package\n- Java: Caffeine or Guava Cache\n- Go: \`groupcache\` or \`ristretto\`\n- Best for: configuration, feature flags, frequently accessed immutable data\n- Invalidation: TTL + pub/sub notification to all instances\n\n**L2 — Distributed cache** (0.5-2ms, 10-100GB):\n- Redis Cluster or Memcached\n- Shared across all application instances\n- Best for: session data, user profiles, API response caching\n- Invalidation: direct DELETE on write, TTL as safety net\n\n**L3 — CDN / Edge cache** (0-50ms, terabytes):\n- Cloudflare, CloudFront, Fastly\n- Best for: static assets, public API responses, HTML pages\n- Invalidation: cache tags, surrogate keys, or purge API\n\n**Cache hierarchy flow**: Request → L1 check → L2 check → L3 check → Origin (database). Each layer handles the miss and populates the cache for the next request. A well-tuned hierarchy achieves 95%+ hit rate at L1+L2, reducing database load dramatically.\n\n**Consistency challenge**: L1 caches across different instances can be inconsistent (Instance A invalidated, Instance B hasn't). Use short L1 TTLs (5-15 seconds) and pub/sub invalidation to minimize the inconsistency window.`,
    },
    {
      title: 'Cache Key Design',
      content: `A good cache key strategy prevents collisions, enables efficient invalidation, and makes debugging easier.\n\n**Key format**: \`{prefix}:{entity}:{id}:{variant}\`\n- Prefix: service or module name for namespacing\n- Entity: the data type (user, product, feed)\n- ID: unique identifier\n- Variant: optional qualifier (locale, version, view)\n\nExamples:\n- \`api:user:123:profile\` — User 123's profile\n- \`api:user:123:feed:page:1\` — User 123's feed, page 1\n- \`api:product:456:en\` — Product 456 in English\n- \`api:search:q=shoes:page=1:sort=price\` — Search results cache\n\n**Hashing long keys**: For complex queries, hash the parameters: \`api:search:{md5(params)}\`. Keep a reverse mapping for debugging.\n\n**Key expiry patterns**:\n- User-specific data: 5-15 min TTL (changes on user action)\n- Catalog data: 1-24 hour TTL (changes infrequently)\n- Computed aggregations: 1-5 min TTL (expensive to recompute)\n- Feature flags: 30-60 second TTL (needs freshness)\n\n**Avoid hot keys**: If one key gets disproportionate traffic (e.g., a viral post), it creates a hotspot on a single Redis shard. Mitigate with key replication (store copies with random suffixes) or L1 caching with very short TTL.`,
    },
  ],
  realWorldExamples: [
    { system: 'Facebook', approach: 'Operates the world\'s largest Memcached deployment (trillions of cache lookups per day). Uses a multi-region cache hierarchy with regional pools and cross-region invalidation via McRouter. Implemented "lease" mechanism to prevent thundering herds.' },
    { system: 'Twitter', approach: 'Redis cluster caching timeline data (fan-out on write). Each user\'s timeline is a Redis sorted set. Cache warming fills timelines for users who have been inactive. L1 in-process cache for hot configuration data.' },
    { system: 'Stack Overflow', approach: 'Famously serves millions of requests with minimal hardware using aggressive multi-layer caching. L1 in-process cache + L2 Redis + HTTP output caching. Most page renders hit zero database queries.' },
    { system: 'Cloudflare', approach: 'CDN-level caching with the Tiered Cache feature: edge PoP → regional tier → origin shield → origin. Cache Tags enable granular purging. Workers KV provides a key-value cache at the edge with eventual consistency.' },
  ],
  tradeoffs: [
    {
      decision: 'Cache-aside vs write-through',
      pros: ['Cache-aside: only caches what\'s read, simpler failure handling', 'Write-through: always consistent, no stale reads', 'Cache-aside: more efficient for read-heavy, write-light workloads'],
      cons: ['Cache-aside: stale data possible, cache miss penalty on first read', 'Write-through: slower writes, caches unrequested data', 'Write-through: complex failure handling if one write succeeds and other fails'],
    },
    {
      decision: 'Redis vs Memcached',
      pros: ['Redis: rich data structures, persistence, pub/sub, Lua scripting', 'Memcached: simpler, multi-threaded (better per-node throughput)', 'Redis: cluster mode with automatic sharding and failover'],
      cons: ['Redis: single-threaded per shard (mitigated by io-threads in v6+)', 'Memcached: no persistence, no data structures beyond key-value', 'Redis: more complex configuration and operational overhead'],
    },
    {
      decision: 'Short TTL (seconds) vs long TTL (hours)',
      pros: ['Short: data stays fresh, inconsistency window is small', 'Long: higher hit rate, less database load', 'Per-entity TTL tuning provides the best balance'],
      cons: ['Short: more cache misses, higher database load', 'Long: stale data served for longer, harder to invalidate reliably', 'Per-entity: more complex configuration and monitoring'],
    },
  ],
};
