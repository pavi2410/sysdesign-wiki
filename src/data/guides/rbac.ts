import type { FeatureGuide } from './types';

export const rbac: FeatureGuide = {
  slug: 'rbac',
  title: 'Role-Based Access Control',
  tagline: 'Permission models, policy engines, and row-level security for multi-user applications',
  category: 'platform',
  tags: ['RBAC', 'permissions', 'authorization', 'security', 'policy'],
  problem: `As applications grow beyond a single user, you need to control who can do what. A junior developer shouldn't delete production databases. A team member shouldn't see billing details. A viewer shouldn't edit documents. Role-Based Access Control (RBAC) assigns permissions to roles, and roles to users — but production systems need more: hierarchical roles, resource-level permissions, attribute-based policies, and real-time permission changes. The authorization check must be fast (sub-millisecond), consistent, and auditable, sitting on every request's critical path.`,
  approaches: [
    {
      name: 'Simple RBAC (Role → Permissions)',
      description: `Define a fixed set of roles (admin, editor, viewer), each with a set of permissions (create, read, update, delete). Assign roles to users. On each request, check if the user's role includes the required permission. Implemented with a roles table and a role_permissions mapping.`,
      pros: [
        'Simple to understand, implement, and audit',
        'Works well for applications with clear role hierarchies',
        'Fast evaluation — single lookup per request',
        'Easy to explain permission model to end users',
      ],
      cons: [
        'Role explosion — too many roles for fine-grained needs',
        'No resource-level permissions (can edit ALL documents, not specific ones)',
        'Adding a new permission requires updating role definitions',
        'Doesn\'t handle complex conditions (time-based, attribute-based)',
      ],
    },
    {
      name: 'Relationship-Based Access Control (ReBAC)',
      description: `Permissions are derived from relationships between users and resources. "User X can edit Document Y because X is a member of Team Z which owns Folder W which contains Document Y." Models the permission graph as a series of relationships (tuples). Used by Google Zanzibar and its open-source derivatives (SpiceDB, OpenFGA).`,
      pros: [
        'Naturally handles resource-level permissions',
        'Supports complex hierarchies (org → team → project → document)',
        'Permission inheritance through relationship chains',
        'Scales to billions of relationships with proper infrastructure',
      ],
      cons: [
        'More complex to implement and reason about',
        'Relationship graph traversal can be slow without caching',
        'Debugging "why can/can\'t user X do Y?" is harder',
        'Requires a dedicated authorization service or infrastructure',
      ],
    },
    {
      name: 'Attribute-Based Access Control (ABAC)',
      description: `Permissions are evaluated based on attributes of the user, resource, action, and environment. Policies are written as rules: "Allow if user.department == resource.department AND action == 'read' AND time.hour >= 9 AND time.hour <= 17." Most flexible but most complex.`,
      pros: [
        'Extremely flexible — any attribute can be a policy input',
        'No role explosion — policies adapt to any dimension',
        'Supports contextual conditions (time, location, IP)',
        'Can model RBAC as a subset (role is just an attribute)',
      ],
      cons: [
        'Policy complexity can become unmanageable',
        'Slower evaluation — must fetch attributes at decision time',
        'Harder to audit ("who has access to what?" is a graph problem)',
        'Requires a policy language (Rego, Cedar, Casbin)',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Clients
        WEB[Web App]
        API_CLIENT[API Client]
    end
    subgraph Gateway["API Gateway"]
        AUTH[Auth Middleware<br/>JWT Validation]
        AUTHZ[Authorization<br/>Middleware]
    end
    subgraph AuthzService["Authorization Service"]
        PE[Policy Engine]
        RC[Role Cache]
        EVAL[Permission<br/>Evaluator]
    end
    subgraph Storage
        DB[(Roles & Permissions<br/>Database)]
        CACHE[(Redis<br/>Permission Cache)]
        AUDIT[(Audit Log)]
    end
    subgraph App["Application Services"]
        SVC1[Service A]
        SVC2[Service B]
    end
    WEB & API_CLIENT --> AUTH
    AUTH --> AUTHZ
    AUTHZ --> EVAL
    EVAL --> RC
    RC --> CACHE
    RC --> DB
    EVAL --> PE
    AUTHZ --> SVC1 & SVC2
    EVAL --> AUDIT`,
  components: [
    { name: 'Policy Engine', description: 'Evaluates authorization policies against the request context (user, resource, action). Supports RBAC role checks, ReBAC relationship traversal, or ABAC attribute evaluation depending on the chosen model. Must return a decision (allow/deny) in under 1ms.' },
    { name: 'Role & Permission Store', description: 'Database tables storing roles, permissions, role-permission mappings, and user-role assignments. In ReBAC, stores relationship tuples (user, relation, object). Supports tenant-scoped roles for multi-tenant applications.' },
    { name: 'Permission Cache', description: 'Redis-based cache of evaluated permissions. Caches user→role mappings and frequently checked permissions. Invalidated on role changes. TTL-based expiry ensures eventual consistency (typically 5-60 second TTL).' },
    { name: 'Authorization Middleware', description: 'Intercepts every API request, extracts the user identity from the JWT, determines the required permission for the endpoint, and calls the policy engine. Returns 403 Forbidden if the check fails. Must be applied consistently across all routes.' },
    { name: 'Admin Dashboard', description: 'UI for managing roles, permissions, and assignments. Supports creating custom roles, viewing effective permissions for a user, and simulating permission checks ("what would happen if user X tried action Y on resource Z?").' },
    { name: 'Audit Logger', description: 'Records every authorization decision (who, what, when, allowed/denied) for compliance and debugging. Enables answering "who accessed this resource?" and "why was this user denied access?" questions.' },
  ],
  dataModel: `erDiagram
    USER {
        string user_id PK
        string email
        string name
    }
    ROLE {
        string role_id PK
        string name
        string description
        string tenant_id FK
        int hierarchy_level
    }
    PERMISSION {
        string permission_id PK
        string resource_type
        string action
        string description
    }
    ROLE_PERMISSION {
        string role_id FK
        string permission_id FK
    }
    USER_ROLE {
        string user_id FK
        string role_id FK
        string scope_type
        string scope_id
        timestamp granted_at
        string granted_by
    }
    AUTHORIZATION_LOG {
        string log_id PK
        string user_id FK
        string action
        string resource_type
        string resource_id
        boolean allowed
        string reason
        timestamp checked_at
    }
    USER ||--o{ USER_ROLE : assigned
    ROLE ||--o{ USER_ROLE : granted_to
    ROLE ||--o{ ROLE_PERMISSION : includes
    PERMISSION ||--o{ ROLE_PERMISSION : part_of
    USER ||--o{ AUTHORIZATION_LOG : checked`,
  deepDive: [
    {
      title: 'Scoped Roles and Resource-Level Permissions',
      content: `Basic RBAC assigns global roles — "User X is an admin." But most apps need scoped roles — "User X is an admin OF project Y but only a viewer OF project Z."\n\n**Implementation**: Add scope fields to the user-role assignment:\n- \`scope_type\`: "organization", "project", "team", "document"\n- \`scope_id\`: the specific resource ID\n\n**Permission check flow**:\n1. User requests to edit Project Y\n2. Look up user's roles scoped to Project Y\n3. Also look up roles scoped to Project Y's parent (Organization Z) — role inheritance\n4. Check if any of those roles include the "project:edit" permission\n5. Allow or deny\n\n**Hierarchy**: Permissions inherit downward. An org admin is implicitly a project admin for all projects in the org. Implement by walking up the resource hierarchy during permission checks. Cache the effective permissions per (user, scope) pair.\n\n**Performance**: With scoped roles, the permission check involves multiple lookups. Pre-compute and cache the effective permission set per user-scope combination. Invalidate cache on role changes (pub/sub notification from the role service).`,
    },
    {
      title: 'Google Zanzibar and ReBAC',
      content: `Google's **Zanzibar** paper (2019) introduced a scalable authorization system based on relationship tuples.\n\n**Core concept**: Authorization data is stored as tuples: \`(object, relation, user)\`. For example:\n- \`(doc:readme, owner, user:alice)\` — Alice owns the readme doc\n- \`(folder:eng, viewer, team:engineering#member)\` — Engineering team members can view the eng folder\n- \`(doc:readme, parent, folder:eng)\` — readme doc is in the eng folder\n\n**Permission check**: "Can Alice view doc:readme?" The system checks:\n1. Is Alice a direct viewer of doc:readme? → No\n2. Does doc:readme have a parent? → Yes, folder:eng\n3. Is Alice a viewer of folder:eng? → Check if Alice is a member of team:engineering → Yes!\n4. Permission granted via relationship chain.\n\n**Open-source implementations**:\n- **SpiceDB** (AuthZed) — Go-based, gRPC API, closest to Zanzibar\n- **OpenFGA** (Auth0/Okta) — supports multiple storage backends\n- **Permify** — Kubernetes-native, schema-first approach\n\nReBAC is ideal when your permission model mirrors your data hierarchy (organizations → projects → resources).`,
    },
    {
      title: 'Performance and Caching Strategy',
      content: `Authorization sits on the hot path of every request. It must be fast.\n\n**Caching layers**:\n1. **In-process cache** (LRU, 1000 entries, 30s TTL): Fastest. Caches (user_id, permission, scope) → boolean. Hit rate: 60-80% for typical web apps.\n2. **Redis cache** (60s TTL): Shared across instances. Caches user's effective role set per scope. Hit rate: 90%+.\n3. **Database** (source of truth): Only hit on cache miss. Must be fast — proper indexes on user_id, role_id, scope columns.\n\n**Cache invalidation**: When a role assignment changes:\n1. Invalidate the user's cache entries (in-process + Redis)\n2. Publish an event so all instances invalidate their local cache\n3. For security-critical changes (role revocation), force re-evaluation by bumping a version counter\n\n**Batch prefetching**: For UI pages that show multiple resources, prefetch permissions for all visible resources in one batch call. "Can user X do [view, edit, delete] on resources [A, B, C, D]?" — single round-trip returning a permission matrix.\n\n**Latency targets**: In-process cache hit: <0.01ms. Redis cache hit: <1ms. Database lookup: <5ms. Any authorization check >10ms indicates a problem.`,
    },
  ],
  realWorldExamples: [
    { system: 'Google Workspace', approach: 'Uses Zanzibar for authorization across Drive, Docs, Calendar, and more. Handles trillions of authorization checks per day. Relationship tuples model sharing (viewer, editor, owner) with inheritance through folders and organizational units.' },
    { system: 'GitHub', approach: 'Scoped RBAC with organization → team → repository hierarchy. Roles (admin, maintain, write, triage, read) are scoped per repository. Team-level permissions inherit to repositories. Custom repository roles available for Enterprise.' },
    { system: 'AWS IAM', approach: 'ABAC policy engine evaluating JSON policies against request context. Policies attached to users, groups, and roles. Supports conditions (IP range, time, MFA), resource-level permissions, and cross-account access via trust policies.' },
    { system: 'Notion', approach: 'ReBAC model where permissions flow through the page hierarchy (workspace → teamspace → page → subpage). Supports sharing individual pages with specific users or groups, overriding inherited permissions.' },
  ],
  tradeoffs: [
    {
      decision: 'RBAC vs ReBAC vs ABAC',
      pros: ['RBAC: simplest to implement and reason about', 'ReBAC: natural for hierarchical data, resource-level permissions', 'ABAC: most flexible, handles any authorization pattern'],
      cons: ['RBAC: role explosion for fine-grained needs', 'ReBAC: requires dedicated infrastructure (SpiceDB, OpenFGA)', 'ABAC: policy complexity can become unmanageable'],
    },
    {
      decision: 'Embedded authorization vs external service',
      pros: ['Embedded: lowest latency, simplest deployment', 'External: centralized policy management across microservices', 'Embedded: no additional infrastructure dependency'],
      cons: ['Embedded: duplicated logic across services, harder to audit', 'External: adds network hop, becomes a critical dependency', 'External: must handle service unavailability (fail open vs closed)'],
    },
    {
      decision: 'Fail-open vs fail-closed on authorization service outage',
      pros: ['Fail-open: application stays available during auth service outage', 'Fail-closed: no unauthorized access is ever possible', 'Cached decisions provide a middle ground'],
      cons: ['Fail-open: security risk during outages', 'Fail-closed: application becomes unavailable if auth service is down', 'Cached decisions may be stale (revoked permissions still cached)'],
    },
  ],
};
