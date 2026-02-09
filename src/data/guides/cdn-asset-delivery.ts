import type { FeatureGuide } from './types';

export const cdnAssetDelivery: FeatureGuide = {
  slug: 'cdn-asset-delivery',
  title: 'CDN & Asset Delivery',
  tagline: 'Origin shielding, cache hierarchies, purging strategies, and global content distribution',
  category: 'media',
  tags: ['CDN', 'caching', 'edge', 'performance', 'Cloudflare', 'CloudFront'],
  problem: `Users expect sub-second page loads regardless of their location. Serving assets (images, scripts, videos, API responses) from a single origin server means users far from the origin experience high latency. A Content Delivery Network (CDN) caches content at edge locations worldwide, serving users from the nearest point of presence (PoP). But CDN configuration is nuanced: choosing what to cache, setting correct cache headers, invalidating stale content, protecting the origin from thundering herds, handling dynamic content at the edge, and optimizing for Core Web Vitals — all while keeping costs manageable.`,
  approaches: [
    {
      name: 'Pull-Based CDN (Cache on First Request)',
      description: `The CDN sits in front of your origin. On the first request for an asset, the CDN fetches it from the origin, caches it at the edge, and serves subsequent requests from cache. No proactive content pushing — the CDN "pulls" content as needed. This is how Cloudflare, CloudFront, and Fastly work by default.`,
      pros: [
        'Zero configuration for basic setup — point DNS at the CDN',
        'Only caches content that\'s actually requested (demand-driven)',
        'Origin only serves cache misses — dramatically reduced load',
        'Automatic geographic distribution',
      ],
      cons: [
        'First request to each PoP hits the origin (cold cache)',
        'Cache misses during traffic spikes can overwhelm the origin',
        'Must tune cache headers carefully for correct caching behavior',
        'Dynamic content requires explicit cache rules',
      ],
    },
    {
      name: 'Push-Based CDN (Pre-Populate Edge)',
      description: `Proactively push content to CDN edge locations before users request it. Upload assets directly to CDN storage (S3 + CloudFront, Cloudflare R2). Eliminates cold-cache penalties for known content. Ideal for static assets (JS bundles, images) that you control.`,
      pros: [
        'No cold cache — content is already at the edge',
        'Origin is not involved in serving static assets',
        'Predictable performance — no cache-miss latency variance',
        'Better for large files (videos) that are expensive to re-fetch',
      ],
      cons: [
        'Must manage asset upload/deployment to CDN storage',
        'Storage costs for pre-populating all edge locations',
        'Not practical for dynamic or user-generated content',
        'Invalidation requires explicit purge across all PoPs',
      ],
    },
    {
      name: 'Edge Compute (CDN Workers)',
      description: `Run code at the CDN edge to serve dynamic content without hitting the origin. **Cloudflare Workers**, **AWS Lambda@Edge**, and **Vercel Edge Functions** execute JavaScript/WASM at PoPs worldwide. Can modify requests, generate responses, and implement custom caching logic at the edge.`,
      pros: [
        'Serve dynamic content with CDN-like latency',
        'Custom caching logic (vary by cookie, A/B test at edge)',
        'API responses can be generated/cached at the edge',
        'Reduces origin load for personalized content',
      ],
      cons: [
        'Limited compute (CPU time, memory) per request',
        'Debugging edge workers is harder than server-side code',
        'Cold starts on some platforms (Lambda@Edge)',
        'Data access from edge requires distributed KV or database',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Users["Global Users"]
        US[US User]
        EU[EU User]
        ASIA[Asia User]
    end
    subgraph CDN["CDN Edge Network"]
        POP_US[US PoP<br/>Edge Cache]
        POP_EU[EU PoP<br/>Edge Cache]
        POP_ASIA[Asia PoP<br/>Edge Cache]
    end
    subgraph Shield["Origin Shield"]
        SHIELD[Shield PoP<br/>Regional Cache]
    end
    subgraph Origin["Origin Infrastructure"]
        LB[Load Balancer]
        APP[App Server]
        S3[(Object Storage)]
    end
    US --> POP_US
    EU --> POP_EU
    ASIA --> POP_ASIA
    POP_US & POP_EU & POP_ASIA -->|Cache Miss| SHIELD
    SHIELD -->|Cache Miss| LB
    LB --> APP
    LB --> S3`,
  components: [
    { name: 'Edge PoP (Point of Presence)', description: 'CDN server location closest to the user. Caches content and serves requests. Major CDNs have 200-300+ PoPs worldwide. Each PoP has its own cache — content popular in one region may not be cached in another. Cache capacity varies by PoP tier (large city vs small).' },
    { name: 'Origin Shield', description: 'A designated CDN PoP that acts as a cache between edge PoPs and your origin. All cache misses from edge PoPs go through the shield PoP instead of directly to the origin. Reduces origin load by up to 90% — the shield coalesces requests from many edge PoPs into single origin requests.' },
    { name: 'Cache Key Configuration', description: 'Defines what makes a cached response unique. By default: URL. Can be extended with: query parameters, headers (Accept-Encoding, Accept-Language), cookies, device type, or geographic region. Incorrect cache keys cause serving wrong content to users (e.g., one user\'s personalized page served to another).' },
    { name: 'Purge/Invalidation API', description: 'Mechanism to remove content from all CDN caches. Options: purge by exact URL, by cache tag (all assets tagged "product-123"), by prefix (/images/*), or purge everything. Cloudflare purge propagates in <30 seconds. CloudFront invalidation takes 5-10 minutes.' },
    { name: 'Image Optimization', description: 'CDN-level image processing: format conversion (WebP/AVIF for supported browsers), resizing, quality adjustment, and lazy loading. Cloudflare Images and CloudFront Functions can transform images on-the-fly at the edge, eliminating the need for pre-generating multiple sizes.' },
    { name: 'Analytics & Monitoring', description: 'CDN-level metrics: cache hit ratio (target: >90%), bandwidth served from cache vs origin, latency per PoP, error rates (5xx from origin), and top requested URLs. Monitor cache hit ratio — a drop indicates misconfigured headers or a purge event.' },
  ],
  dataModel: `erDiagram
    CDN_ASSET {
        string asset_key PK
        string origin_url
        string content_type
        int size_bytes
        string cache_control
        string etag
        string[] cache_tags
        timestamp last_modified
    }
    CDN_RULE {
        string rule_id PK
        string path_pattern
        string cache_control
        int edge_ttl_seconds
        int browser_ttl_seconds
        boolean origin_shield
        json custom_headers
    }
    PURGE_REQUEST {
        string purge_id PK
        enum purge_type
        string target
        enum status
        string requested_by
        timestamp created_at
        timestamp completed_at
    }
    CDN_METRIC {
        string metric_id PK
        string pop_location
        int cache_hits
        int cache_misses
        float hit_ratio
        int bandwidth_bytes
        float avg_latency_ms
        timestamp window_start
    }
    CDN_RULE ||--o{ CDN_ASSET : governs
    CDN_ASSET ||--o{ PURGE_REQUEST : purged_by`,
  deepDive: [
    {
      title: 'Cache-Control Headers Deep Dive',
      content: `The \`Cache-Control\` header is the most important lever for CDN behavior.\n\n**Key directives**:\n- \`public, max-age=31536000, immutable\` — Cache forever. Use for fingerprinted assets (app.a1b2c3.js). The "immutable" hint tells browsers not to revalidate even on refresh.\n- \`public, max-age=0, must-revalidate\` — Always revalidate with origin. CDN stores the content but checks freshness on every request (conditional GET with ETag/If-Modified-Since).\n- \`public, s-maxage=3600, max-age=60\` — CDN caches for 1 hour, browser caches for 1 minute. Different TTLs for edge vs browser.\n- \`private, no-store\` — Never cache anywhere. Use for personalized or sensitive responses.\n- \`stale-while-revalidate=60\` — Serve stale content while fetching fresh version in background. Great for API responses.\n\n**Common patterns**:\n- **Static assets** (JS, CSS, images with hash): \`max-age=31536000, immutable\`\n- **HTML pages**: \`s-maxage=60, stale-while-revalidate=300\` (CDN caches 1 min, serves stale for 5 min while refreshing)\n- **API responses**: \`s-maxage=10, stale-while-revalidate=30\` (CDN caches 10s, users always get fast response)\n- **User-specific data**: \`private, no-cache\` or \`private, max-age=0\`\n\n**Vary header**: Tells the CDN to cache separate versions based on request headers. \`Vary: Accept-Encoding\` caches gzip and brotli versions separately. \`Vary: Accept\` for content negotiation (WebP vs JPEG). Avoid \`Vary: Cookie\` — creates a separate cache entry per user, destroying cache efficiency.`,
    },
    {
      title: 'Origin Shield and Tiered Caching',
      content: `Without origin shield, each of 300 CDN PoPs independently fetches content from your origin on a cache miss. A popular asset could trigger 300 concurrent origin requests.\n\n**Origin shield** inserts a middle tier:\n1. User requests asset from nearest PoP (edge tier)\n2. Edge PoP cache miss → forward to origin shield PoP (mid tier)\n3. Shield PoP cache miss → forward to origin\n4. Shield caches the response → all future edge misses are served from shield\n\n**Benefits**:\n- Origin receives at most 1 request per asset (from the shield), not 300\n- Dramatically reduces origin bandwidth and compute\n- Shield PoP has a much higher cache hit ratio (aggregated from all edges)\n- Origin can be smaller and cheaper\n\n**Shield PoP selection**: Choose a shield PoP near your origin for lowest latency. Cloudflare calls this "Tiered Cache" and auto-selects optimal shield locations. CloudFront calls it "Origin Shield" with manual region selection.\n\n**Cost consideration**: Shield adds an extra CDN hop (edge → shield → origin). Slightly higher latency on cache misses (extra network hop). But the dramatically improved cache hit ratio more than compensates. Most platforms see 95%+ shield hit ratio.`,
    },
    {
      title: 'Cache Invalidation Strategies',
      content: `When content changes, you need the CDN to serve the new version. Several strategies:\n\n**Cache busting (fingerprinting)**: Include a content hash in the filename: \`app.a1b2c3.js\`. When content changes, the filename changes. Old version stays cached (never served again since nothing links to it). New version is fetched fresh. This is the **best approach for static assets** — no purging needed.\n\n**Cache tags (surrogate keys)**: Tag cached responses with metadata: \`Cache-Tag: product-123, category-shoes\`. When product 123 changes, purge all responses tagged "product-123". Supported by Cloudflare, Fastly, and CloudFront (via Lambda@Edge). Ideal for dynamic content with known invalidation patterns.\n\n**TTL-based expiry**: Set a short TTL and accept temporary staleness. Simple but imprecise. Use \`stale-while-revalidate\` to serve stale content immediately while refreshing in the background — users always get fast responses.\n\n**Purge API**: Programmatically purge specific URLs or patterns. Cloudflare supports per-URL, per-tag, per-hostname, and full purge. Trigger purges from your CI/CD pipeline on deployment or from your CMS when content is published.\n\n**Soft purge (Fastly)**: Mark content as stale rather than deleting it. The CDN serves the stale version while fetching a fresh copy from the origin. Eliminates the "thundering herd" that happens when a purge causes all PoPs to simultaneously request from origin.\n\n**Best practice**: Use fingerprinted URLs for static assets (never purge) + cache tags for dynamic content (targeted purge) + short TTL with stale-while-revalidate as a safety net.`,
    },
  ],
  realWorldExamples: [
    { system: 'Cloudflare', approach: 'Reverse proxy CDN with 300+ PoPs. Tiered caching with automatic shield selection. Cache Tags for granular purging. Workers for edge compute. Argo Smart Routing for optimal origin connectivity. Free tier with generous limits.' },
    { system: 'Netflix', approach: 'Open Connect CDN — Netflix\'s own CDN embedded in ISP networks worldwide. ISPs host Netflix servers (Open Connect Appliances) that cache popular content locally. Serves 100% of video traffic from OCA boxes, zero from origin during peak hours.' },
    { system: 'Vercel', approach: 'Edge-first deployment platform. Static assets are pushed to the edge on deploy (push CDN). Server-rendered pages cached with ISR (Incremental Static Regeneration) — stale-while-revalidate at the CDN level. Edge Functions for dynamic personalization.' },
    { system: 'Shopify', approach: 'Global CDN serving millions of storefronts. Intelligent caching per store with automatic purging on content changes. Image CDN that resizes and converts images on-the-fly. Handles Black Friday traffic spikes with aggressive edge caching and origin shielding.' },
  ],
  tradeoffs: [
    {
      decision: 'Pull CDN vs push CDN for static assets',
      pros: ['Pull: zero-config, automatic caching on first request', 'Push: no cold cache, predictable performance from the start', 'Pull: works for any content including dynamic responses'],
      cons: ['Pull: first request per PoP is slow (origin fetch)', 'Push: must manage upload/deployment to CDN storage', 'Push: only practical for static, known-ahead-of-time content'],
    },
    {
      decision: 'Long TTL + purge vs short TTL + stale-while-revalidate',
      pros: ['Long TTL: highest cache hit ratio, lowest origin load', 'Short TTL + SWR: always fresh, no purge infrastructure needed', 'Long TTL: best for static assets that change infrequently'],
      cons: ['Long TTL: must implement reliable purging on content changes', 'Short TTL: more origin requests (revalidation checks)', 'Long TTL + failed purge = serving stale content indefinitely'],
    },
    {
      decision: 'Single CDN vs multi-CDN strategy',
      pros: ['Single: simpler DNS, billing, and configuration', 'Multi: redundancy, performance optimization per region', 'Multi: negotiate better pricing with competition'],
      cons: ['Single: single point of failure at the CDN level', 'Multi: complex DNS routing (latency-based, geo), split analytics', 'Multi: more operational complexity, different APIs per CDN'],
    },
  ],
};
