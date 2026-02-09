import type { FeatureGuide } from './types';

export const multiTenant: FeatureGuide = {
  slug: 'multi-tenant-architecture',
  title: 'Multi-Tenant Architecture',
  tagline: 'Shared infrastructure with tenant isolation, noisy neighbor protection, and per-tenant customization',
  category: 'platform',
  tags: ['multi-tenant', 'SaaS', 'isolation', 'database', 'scaling'],
  problem: `SaaS applications serve multiple customers (tenants) from shared infrastructure. The challenge is balancing cost efficiency (shared resources) with isolation (one tenant's data, load, or failures shouldn't affect others). Multi-tenancy touches every layer — database, compute, caching, queues, and storage. You must decide how much isolation each tier of customer gets, how to route requests to the right tenant context, and how to handle tenants that outgrow the shared model.`,
  approaches: [
    {
      name: 'Shared Database, Shared Schema',
      description: `All tenants share the same database and tables. A \`tenant_id\` column on every table discriminates data. Application code adds \`WHERE tenant_id = ?\` to every query. Simplest and most cost-effective approach, used by most early-stage SaaS.`,
      pros: [
        'Lowest infrastructure cost — one database for all tenants',
        'Simplest to deploy and manage',
        'Easy cross-tenant analytics and reporting',
        'Database migrations apply to all tenants at once',
      ],
      cons: [
        'Risk of data leaks if tenant_id filter is missed (security critical)',
        'Noisy neighbor — one tenant\'s heavy query affects all others',
        'Hard to meet data residency requirements per tenant',
        'Schema customization per tenant is difficult',
      ],
    },
    {
      name: 'Shared Database, Separate Schemas',
      description: `Each tenant gets their own database schema (PostgreSQL schemas, MySQL databases) within a shared database server. Provides logical isolation while sharing compute resources. Tenant routing happens at the connection/schema level.`,
      pros: [
        'Logical data isolation — harder to accidentally leak data',
        'Per-tenant schema customization is possible',
        'Can use database-level access controls per schema',
        'Easier to export/delete a single tenant\'s data (GDPR)',
      ],
      cons: [
        'Schema migrations must run per-tenant — can be slow with many tenants',
        'Connection pooling is more complex (pool per schema or dynamic switching)',
        'Still shares compute — noisy neighbor at the DB server level',
        'Operational overhead grows with tenant count',
      ],
    },
    {
      name: 'Database per Tenant',
      description: `Each tenant gets a completely separate database instance. Maximum isolation at maximum cost. Reserved for enterprise tiers, regulated industries, or tenants with data residency requirements.`,
      pros: [
        'Complete data isolation — strongest security boundary',
        'Per-tenant performance tuning and scaling',
        'Easy to meet data residency (place DB in specific region)',
        'Tenant migration and backup/restore is straightforward',
      ],
      cons: [
        'Highest infrastructure cost',
        'Operational complexity grows linearly with tenants',
        'Cross-tenant queries and analytics require federation',
        'Connection management across hundreds of databases is challenging',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Clients
        T1[Tenant A Users]
        T2[Tenant B Users]
        T3[Tenant C Users]
    end
    subgraph Edge["Routing Layer"]
        LB[Load Balancer]
        TR[Tenant Router<br/>Middleware]
    end
    subgraph App["Application Layer"]
        API1[API Instance 1]
        API2[API Instance 2]
    end
    subgraph Data["Data Layer"]
        direction TB
        subgraph Shared["Shared Tier"]
            SDB[(Shared DB<br/>tenant_id column)]
        end
        subgraph Dedicated["Premium Tier"]
            DB1[(Tenant C DB)]
        end
        CACHE[(Redis Cache<br/>key-prefixed)]
        Q[(Job Queue<br/>tenant-tagged)]
    end
    T1 & T2 & T3 --> LB
    LB --> TR
    TR --> API1 & API2
    API1 & API2 --> SDB
    API1 & API2 --> DB1
    API1 & API2 --> CACHE
    API1 & API2 --> Q`,
  components: [
    { name: 'Tenant Router Middleware', description: 'Extracts tenant context from the request (subdomain, custom domain, JWT claim, or API key). Sets tenant_id in the request context so all downstream code operates in the correct tenant scope. This is the most security-critical component — a bug here causes cross-tenant data leaks.' },
    { name: 'Tenant-Aware Data Layer', description: 'Wraps database queries to automatically inject tenant_id filters. In shared-schema mode, uses row-level security (Postgres RLS) or ORM scoping. In separate-schema mode, switches the connection\'s search_path. In DB-per-tenant mode, selects the correct connection from a pool registry.' },
    { name: 'Tenant Configuration Store', description: 'Stores per-tenant settings: plan tier, feature flags, rate limits, custom branding, SSO configuration, and data residency requirements. Cached in Redis with tenant_id as the key prefix. Loaded on first request and refreshed periodically.' },
    { name: 'Resource Quotas & Rate Limiter', description: 'Enforces per-tenant limits on API calls, storage, compute, and bandwidth. Prevents noisy neighbor scenarios by throttling tenants that exceed their allocation. Uses token bucket or sliding window algorithms keyed by tenant_id.' },
    { name: 'Tenant Provisioning Service', description: 'Automates new tenant setup: creates database schemas/instances, seeds default data, configures DNS entries, and sets initial quotas. Runs as a background job triggered by signup or plan upgrade.' },
    { name: 'Tenant Isolation Monitor', description: 'Monitors for cross-tenant data access violations, query performance per tenant, and resource consumption anomalies. Alerts on potential noisy neighbor situations and data isolation breaches.' },
  ],
  dataModel: `erDiagram
    TENANT {
        string tenant_id PK
        string name
        string slug UK
        enum plan_tier
        string db_strategy
        string db_connection_ref
        json settings
        timestamp created_at
    }
    TENANT_MEMBER {
        string member_id PK
        string tenant_id FK
        string user_id FK
        enum role
        timestamp joined_at
    }
    TENANT_QUOTA {
        string tenant_id FK
        string resource_type
        int limit_value
        int current_usage
        timestamp reset_at
    }
    TENANT_DOMAIN {
        string domain_id PK
        string tenant_id FK
        string domain
        enum status
    }
    TENANT ||--o{ TENANT_MEMBER : has
    TENANT ||--o{ TENANT_QUOTA : limited_by
    TENANT ||--o{ TENANT_DOMAIN : accessible_via`,
  deepDive: [
    {
      title: 'Tenant Identification Strategies',
      content: `Every request must be mapped to a tenant. Common strategies:\n\n**Subdomain-based**: \`acme.yourapp.com\` → tenant "acme". Parse the Host header, strip the platform domain, look up the tenant by slug. Simple and user-friendly. Requires wildcard DNS and certificates.\n\n**Path-based**: \`yourapp.com/acme/...\` → tenant "acme". Works without DNS configuration but pollutes the URL namespace. Less common for customer-facing apps.\n\n**Custom domain**: \`app.acme.com\` → tenant "acme". Lookup domain in the routing table. Best UX for customers but requires custom domain infrastructure (see Custom Domains guide).\n\n**JWT/API key**: Extract tenant_id from the authentication token. Works for API-first products. The auth system must embed tenant context in the token at login/key-creation time.\n\n**Header-based**: \`X-Tenant-ID\` header set by an upstream gateway. Used in microservice architectures where a gateway handles tenant resolution and downstream services trust the header.`,
    },
    {
      title: 'Row-Level Security with PostgreSQL',
      content: `PostgreSQL's **Row-Level Security (RLS)** provides database-enforced tenant isolation in shared-schema mode.\n\n**Setup**:\n1. Add \`tenant_id\` column to every table\n2. Enable RLS: \`ALTER TABLE orders ENABLE ROW LEVEL SECURITY;\`\n3. Create policy: \`CREATE POLICY tenant_isolation ON orders USING (tenant_id = current_setting('app.tenant_id'));\`\n4. At request start, set the session variable: \`SET app.tenant_id = 'tenant_abc';\`\n\n**Benefits**: Even if application code forgets to filter by tenant_id, the database enforces it. This is a defense-in-depth strategy — bugs in application code cannot leak data across tenants.\n\n**Caveats**:\n- RLS adds a small query planning overhead (~1-5%)\n- Superuser roles bypass RLS — never use superuser in the application\n- Must be applied to every table — easy to miss new tables\n- Index on tenant_id is essential for performance\n- Connection poolers (PgBouncer) in transaction mode require SET LOCAL instead of SET`,
    },
    {
      title: 'Noisy Neighbor Mitigation',
      content: `The "noisy neighbor" problem occurs when one tenant's workload degrades performance for others.\n\n**Database layer**:\n- Set per-tenant statement timeouts to kill long-running queries\n- Use connection pooling with per-tenant limits (max 10 connections per tenant)\n- Monitor per-tenant query latency and alert on outliers\n- Consider read replicas for heavy-read tenants\n\n**Application layer**:\n- Per-tenant rate limiting on API endpoints\n- Separate job queues for background tasks (or priority queues with tenant-based priority)\n- Memory/CPU limits per request using timeouts and circuit breakers\n\n**Cache layer**:\n- Prefix all cache keys with tenant_id to prevent collisions\n- Set per-tenant memory limits or use separate Redis databases\n- Implement cache eviction policies that don't let one tenant flush others' cache\n\n**Nuclear option**: Automatically migrate noisy tenants to dedicated infrastructure when they consistently exceed thresholds. This is the "tiered isolation" approach — start shared, promote to dedicated as needed.`,
    },
  ],
  realWorldExamples: [
    { system: 'Slack', approach: 'Each workspace is a tenant. Uses shared-schema with workspace_id on every table. Enterprise Grid connects multiple workspaces under one organization with cross-workspace features.' },
    { system: 'Shopify', approach: 'Millions of merchant stores on shared infrastructure. Uses a sharded database architecture with pod-based isolation. Large merchants (Shopify Plus) get dedicated resources with higher rate limits.' },
    { system: 'Salesforce', approach: 'Pioneered the shared-schema multi-tenant model. All customers share the same database with org_id discrimination. Uses a metadata-driven architecture for per-tenant schema customization.' },
    { system: 'AWS (Control Plane)', approach: 'AWS services use a "silo" model for large accounts and "pool" model for smaller ones. Critical control planes run in separate cells to contain blast radius. Each cell serves a subset of tenants.' },
  ],
  tradeoffs: [
    {
      decision: 'Shared schema vs database-per-tenant',
      pros: ['Shared: lowest cost, simplest ops, easy cross-tenant features', 'Per-tenant: strongest isolation, easiest compliance, per-tenant scaling', 'Shared: migrations are atomic across all tenants'],
      cons: ['Shared: data leak risk, noisy neighbor, hard data residency', 'Per-tenant: high cost, O(N) migrations, complex connection management', 'Hybrid (tiered): most flexible but most complex to build and operate'],
    },
    {
      decision: 'Application-level vs database-level isolation (RLS)',
      pros: ['Application-level: flexible, works with any database', 'Database-level (RLS): defense-in-depth, cannot be bypassed by app bugs', 'Both together provide the strongest guarantees'],
      cons: ['Application-level: single bug can leak data across tenants', 'Database-level: adds query overhead, complex setup, DB-specific', 'Both: more development and testing effort'],
    },
    {
      decision: 'Subdomain vs custom domain tenant routing',
      pros: ['Subdomain: simple DNS, free TLS with wildcard cert', 'Custom domain: best branding for customers, professional appearance', 'Both: support both simultaneously for different customer tiers'],
      cons: ['Subdomain: less professional, customers want their own domain', 'Custom domain: complex infrastructure (DNS, TLS, proxy)', 'Both: more routing logic and edge cases to handle'],
    },
  ],
};
