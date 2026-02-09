import type { FeatureGuide } from './types';

export const apiVersioning: FeatureGuide = {
  slug: 'api-versioning',
  title: 'API Versioning',
  tagline: 'Backward-compatible API evolution with URL, header, and content negotiation strategies',
  category: 'reliability',
  tags: ['API', 'versioning', 'REST', 'backward-compatibility', 'deprecation'],
  problem: `APIs are contracts with external consumers. Once published, changing a response shape, removing a field, or altering behavior can break thousands of integrations. Yet APIs must evolve — new features, performance improvements, and security fixes require changes. API versioning lets you introduce breaking changes without disrupting existing clients by maintaining multiple versions simultaneously. The challenge is choosing a versioning strategy, managing the lifecycle of each version, minimizing code duplication across versions, and eventually sunsetting old versions gracefully.`,
  approaches: [
    {
      name: 'URL Path Versioning',
      description: `Include the version in the URL path: \`/api/v1/users\`, \`/api/v2/users\`. The most visible and widely used approach. Each major version is a distinct URL namespace.`,
      pros: [
        'Most explicit and visible — version is obvious in every request',
        'Easy to route at the load balancer or gateway level',
        'Simple to cache (different URLs = different cache entries)',
        'Easy to document and test each version independently',
      ],
      cons: [
        'URL changes break bookmarks and hardcoded links',
        'Can lead to URL proliferation (/v1, /v2, /v3...)',
        'Philosophically impure — the version isn\'t part of the resource identity',
        'Harder to share common logic across versions without duplication',
      ],
    },
    {
      name: 'Header-Based Versioning',
      description: `Version is specified in a custom HTTP header: \`X-API-Version: 2\` or using the \`Accept\` header with content negotiation: \`Accept: application/vnd.myapi.v2+json\`. URLs remain stable across versions.`,
      pros: [
        'Clean URLs — resource identity doesn\'t change across versions',
        'More RESTful — version is metadata, not part of the resource',
        'Can default to latest version if no header is provided',
        'Supports gradual migration — clients opt into new versions',
      ],
      cons: [
        'Version is hidden — harder to discover and debug',
        'Requires custom header handling in every client',
        'Load balancer routing based on headers is more complex',
        'Caching is trickier — must use Vary header',
      ],
    },
    {
      name: 'Query Parameter Versioning',
      description: `Version as a query parameter: \`/api/users?version=2\`. Simple to implement and test. Less common in production APIs but useful for internal services.`,
      pros: [
        'Easy to test — just change the query parameter',
        'No URL structure changes',
        'Simple to implement — just read a query param',
        'Works well for internal APIs and GraphQL',
      ],
      cons: [
        'Pollutes the query string with non-resource concerns',
        'Easy to forget — defaults can be surprising',
        'Caching must include the version parameter in the cache key',
        'Less conventional for public APIs',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Clients
        OLD[Legacy Client<br/>v1]
        NEW[New Client<br/>v2]
        MOBILE[Mobile App<br/>v1 pinned]
    end
    subgraph Gateway["API Gateway"]
        ROUTER[Version Router]
        TRANSFORM[Response<br/>Transformer]
    end
    subgraph Versions["Version Handlers"]
        V1[v1 Controller<br/>Legacy format]
        V2[v2 Controller<br/>New format]
    end
    subgraph Core["Shared Core"]
        SVC[Business Logic<br/>Service Layer]
        DB[(Database)]
    end
    subgraph Lifecycle["Version Lifecycle"]
        DOCS[API Docs<br/>per version]
        DEP[Deprecation<br/>Manager]
        METRICS[Usage<br/>Metrics]
    end
    OLD --> ROUTER
    NEW --> ROUTER
    MOBILE --> ROUTER
    ROUTER --> V1 & V2
    V1 & V2 --> TRANSFORM
    V1 & V2 --> SVC
    SVC --> DB
    ROUTER --> DOCS
    ROUTER --> METRICS
    METRICS --> DEP`,
  components: [
    { name: 'Version Router', description: 'Extracts the requested API version from the URL path, header, or query parameter. Routes the request to the appropriate version handler. Returns an error if the requested version is unsupported or has been sunset. Adds version info to response headers.' },
    { name: 'Version Controllers', description: 'Thin adapter layers that translate between the versioned API contract and the shared business logic. v1 controller maps to/from the v1 request/response format, v2 controller maps to/from v2 format. Both call the same underlying service layer.' },
    { name: 'Response Transformer', description: 'Transforms the internal data representation to the version-specific response format. Can add/remove fields, rename keys, change data types, and restructure nested objects. Implemented as middleware or decorators on the response path.' },
    { name: 'Deprecation Manager', description: 'Tracks version lifecycle: active, deprecated, sunset. Adds Deprecation and Sunset headers to responses for deprecated versions. Sends notifications to API consumers using deprecated versions. Enforces sunset by returning 410 Gone after the sunset date.' },
    { name: 'API Documentation Generator', description: 'Generates version-specific API documentation (OpenAPI/Swagger). Each version has its own spec file. Shows deprecation notices and migration guides for deprecated versions. Auto-generated from code annotations or schema definitions.' },
    { name: 'Version Usage Metrics', description: 'Tracks API call volume per version, per client. Identifies which clients are still using deprecated versions. Provides data for sunset decisions — don\'t sunset a version with significant traffic without reaching out to affected clients.' },
  ],
  dataModel: `erDiagram
    API_VERSION {
        string version_id PK
        string version_label
        enum status
        timestamp released_at
        timestamp deprecated_at
        timestamp sunset_at
        string changelog_url
    }
    API_ENDPOINT {
        string endpoint_id PK
        string version_id FK
        string method
        string path
        json request_schema
        json response_schema
        boolean deprecated
    }
    VERSION_USAGE {
        string usage_id PK
        string version_id FK
        string client_id
        string endpoint
        int request_count
        timestamp window_start
    }
    MIGRATION_GUIDE {
        string guide_id PK
        string from_version FK
        string to_version FK
        json breaking_changes
        string migration_steps
    }
    API_VERSION ||--o{ API_ENDPOINT : contains
    API_VERSION ||--o{ VERSION_USAGE : tracked_by
    API_VERSION ||--o{ MIGRATION_GUIDE : has`,
  deepDive: [
    {
      title: 'Additive Changes vs Breaking Changes',
      content: `Not every change requires a new API version. Understand what's breaking and what's not.\n\n**Non-breaking (additive) changes** — safe to deploy without versioning:\n- Adding a new optional field to the response\n- Adding a new optional query parameter\n- Adding a new endpoint\n- Adding a new enum value (if clients handle unknown values)\n- Increasing rate limits\n- Adding new webhook event types\n\n**Breaking changes** — require a new version:\n- Removing or renaming a field in the response\n- Changing a field's data type (string → number)\n- Making a previously optional parameter required\n- Changing the URL structure\n- Removing an endpoint\n- Changing error response format\n- Changing authentication mechanism\n- Altering the semantics of an existing field\n\n**Best practice**: Design APIs to be as additive as possible. Use nullable fields, optional parameters, and extensible enums from day one. This minimizes the frequency of breaking changes and the need for new major versions. Many successful APIs (Stripe, Twilio) have maintained backward compatibility within a single version for years through careful additive evolution.`,
    },
    {
      title: 'The Stripe Date-Based Versioning Model',
      content: `Stripe uses a unique versioning approach that's become an industry model.\n\n**How it works**:\n- Each API key is pinned to the version that was current when the key was created (e.g., 2024-01-15)\n- Breaking changes are released as new dated versions (2024-06-01)\n- Clients can override their pinned version per-request with a header: \`Stripe-Version: 2024-06-01\`\n- All changes between versions are documented with exact diffs\n\n**Implementation**: Internally, Stripe maintains a chain of version transformers. The latest code always runs, and a series of backward-compatibility layers transform the response to match the requested version. When a client requests version 2024-01-15, the response passes through transformers for every version between 2024-01-15 and the current version — each transformer reverting one breaking change.\n\n**Benefits**:\n- No URL changes — ever\n- Clients upgrade on their own schedule\n- Each breaking change is individually documented and revertible\n- New integrations automatically get the latest version\n\n**Drawbacks**:\n- Complex transformer chain for old versions (technical debt)\n- Testing matrix grows with each version\n- Must maintain backward compatibility layers indefinitely (or until sunset)`,
    },
    {
      title: 'Version Sunset Strategy',
      content: `Old versions can't live forever — they accumulate technical debt and security risk.\n\n**Sunset timeline**:\n1. **Announce deprecation**: 6-12 months before sunset. Add \`Deprecation\` header to all responses. Send email to all API consumers using the deprecated version.\n2. **Migration period**: Provide a detailed migration guide with before/after examples. Offer office hours or support for complex migrations.\n3. **Warning escalation**: 3 months before sunset, start returning \`Warning\` headers. Log deprecated version usage and reach out to top consumers.\n4. **Sunset**: Return \`410 Gone\` for all requests to the sunset version. Include the migration guide URL in the error response body.\n\n**Sunset headers** (RFC 8594):\n- \`Deprecation: Sat, 01 Jan 2025 00:00:00 GMT\`\n- \`Sunset: Sat, 01 Jul 2025 00:00:00 GMT\`\n- \`Link: </docs/migration-v1-v2>; rel="deprecation"\`\n\n**Decision criteria for sunset**:\n- Less than 1% of total API traffic on the old version\n- All major consumers have migrated (verify via usage metrics)\n- Security vulnerabilities in the old version that can't be patched\n- Maintaining the old version blocks a critical feature or infrastructure change\n\n**Never sunset without notice**: Even if traffic is near-zero, always announce. Someone's production integration might only run monthly.`,
    },
  ],
  realWorldExamples: [
    { system: 'Stripe', approach: 'Date-based versioning (e.g., 2024-06-01) with per-API-key pinning. Version override via Stripe-Version header. Backward-compatibility transformer chain. Extensive changelog documenting every change between versions.' },
    { system: 'GitHub', approach: 'Date-based versioning for the REST API (2022-11-28). URL path versioning for GraphQL (/graphql). Deprecation notices in response headers. Preview features available via Accept header media type.' },
    { system: 'Twilio', approach: 'Date-based URL path versioning (/2010-04-01/Accounts/...). Extremely long support windows — the 2010 API is still functional. New dated versions introduce breaking changes while old versions remain stable.' },
    { system: 'Google Cloud', approach: 'Major version in the URL path (/v1, /v2). Follows a formal version lifecycle: preview → GA → deprecated → shutdown. Minimum 1-year deprecation notice for GA APIs. Version policy documented in the API Improvement Proposals (AIPs).' },
  ],
  tradeoffs: [
    {
      decision: 'URL path vs header-based versioning',
      pros: ['URL: explicit, cacheable, easy routing at the gateway', 'Header: clean URLs, more RESTful, version is metadata', 'URL: most widely understood, best developer experience'],
      cons: ['URL: changes resource identity, URL proliferation', 'Header: hidden, harder to debug, requires Vary for caching', 'Header: clients must set custom headers, easy to forget'],
    },
    {
      decision: 'Date-based vs integer-based version numbers',
      pros: ['Date: clear temporal context, natural for changelogs', 'Integer: simpler, easier to compare (v2 > v1)', 'Date: can have many micro-versions without confusion'],
      cons: ['Date: longer identifiers, harder to remember', 'Integer: fewer versions discourage breaking changes (good or bad)', 'Date: may imply time-based support windows that aren\'t intended'],
    },
    {
      decision: 'Version-specific code vs transformer chain',
      pros: ['Specific code: clear separation, each version is self-contained', 'Transformer: one codebase, backward compat as layers', 'Transformer: less code duplication, easier bug fixes'],
      cons: ['Specific code: duplication across versions, bug fixes needed in all', 'Transformer: growing chain of transforms adds complexity', 'Transformer: harder to understand the effective behavior per version'],
    },
  ],
};
