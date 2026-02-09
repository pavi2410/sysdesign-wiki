import type { FeatureGuide } from './types';

export const auditLogging: FeatureGuide = {
  slug: 'audit-logging',
  title: 'Audit Logging',
  tagline: 'Append-only event stores, tamper-proof records, and compliance-ready activity trails',
  category: 'security',
  tags: ['audit', 'logging', 'compliance', 'security', 'immutable'],
  problem: `Regulated industries (healthcare, finance, government) and security-conscious applications need a complete, tamper-proof record of who did what, when, and from where. Audit logs answer questions like "Who accessed this patient record?", "Who changed the billing amount?", and "What admin actions were taken during the incident?" Unlike application logs (for debugging), audit logs are legal records that may be subpoenaed. They must be immutable, complete, queryable, and retained for years — while adding minimal latency to the operations being audited.`,
  approaches: [
    {
      name: 'Application-Level Audit Middleware',
      description: `Intercept operations at the application layer and emit structured audit events. Middleware on API routes captures the actor, action, resource, and outcome. Events are written to a dedicated audit log store asynchronously to avoid impacting request latency.`,
      pros: [
        'Rich context — captures business-level semantics (not just SQL)',
        'Can include request context (IP, user agent, session)',
        'Flexible — audit only what matters, skip noisy operations',
        'Works with any database and framework',
      ],
      cons: [
        'Must be added to every relevant code path — easy to miss',
        'Application bugs can cause missing or incorrect audit entries',
        'Developers must remember to add audit logging to new features',
        'Bypassed by direct database access',
      ],
    },
    {
      name: 'Database-Level Audit Triggers',
      description: `Use database triggers or change data capture (CDC) to automatically record every INSERT, UPDATE, and DELETE in an audit table. Captures all changes regardless of which application or user made them.`,
      pros: [
        'Captures ALL data changes — nothing can be missed',
        'Cannot be bypassed by application code',
        'Automatic — no developer action needed for new tables',
        'Includes before/after values for every change',
      ],
      cons: [
        'No application context (who initiated the change, from which UI)',
        'High volume — every row change generates an audit entry',
        'Performance impact on write-heavy tables',
        'Database-specific implementation (Postgres triggers differ from MySQL)',
      ],
    },
    {
      name: 'Event Sourcing as Audit Log',
      description: `If your system uses **event sourcing**, the event store IS the audit log. Every state change is recorded as an immutable event. The current state is derived by replaying events. The complete history is preserved by design.`,
      pros: [
        'Audit logging is built into the architecture — not an afterthought',
        'Complete history with perfect fidelity',
        'Can reconstruct state at any point in time',
        'Events are immutable by design',
      ],
      cons: [
        'Event sourcing is a major architectural commitment',
        'Not practical to retrofit into existing CRUD applications',
        'Event store can grow very large over time',
        'Querying historical state requires event replay or projections',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph App["Application Layer"]
        API[API Server]
        MW[Audit Middleware]
    end
    subgraph AuditPipeline["Audit Pipeline"]
        Q[Event Queue<br/>Kafka / SQS]
        PROC[Audit Processor]
        SIGN[Integrity<br/>Signer]
    end
    subgraph Storage["Audit Storage"]
        HOT[(Hot Store<br/>PostgreSQL / ES<br/>Last 90 days)]
        COLD[(Cold Store<br/>S3 / Glacier<br/>7+ years)]
        HASH[(Hash Chain<br/>Tamper Detection)]
    end
    subgraph Access["Access Layer"]
        QUERY[Audit Query API]
        DASH[Audit Dashboard]
        EXPORT[Compliance<br/>Export]
    end
    API --> MW
    MW --> Q
    Q --> PROC
    PROC --> SIGN
    SIGN --> HOT
    SIGN --> HASH
    HOT -->|Archive| COLD
    HOT --> QUERY
    QUERY --> DASH
    QUERY --> EXPORT`,
  components: [
    { name: 'Audit Middleware', description: 'Intercepts API requests and emits structured audit events. Captures: actor (user ID, IP, session), action (HTTP method, business operation), resource (type, ID), outcome (success/failure, status code), and timestamp. Emits events asynchronously to avoid blocking the request.' },
    { name: 'Audit Processor', description: 'Consumes audit events from the queue, enriches them with additional context (actor name, resource details), validates the event schema, and writes to the audit store. Handles deduplication and ordering. Runs as a separate service for isolation.' },
    { name: 'Integrity Signer', description: 'Generates a cryptographic hash chain for tamper detection. Each audit entry includes a hash of itself plus the previous entry\'s hash, forming an append-only chain. Any modification to a historical entry breaks the chain. Similar to a simplified blockchain.' },
    { name: 'Hot Audit Store', description: 'Queryable database for recent audit logs (last 90 days). PostgreSQL with proper indexing (actor, resource, timestamp) or Elasticsearch for full-text search across audit entries. Optimized for fast queries and filtering.' },
    { name: 'Cold Archive', description: 'Long-term storage for audit logs beyond the hot window. S3 with lifecycle policies moving to Glacier/Deep Archive after 1 year. Stored as compressed, encrypted Parquet or JSON files. Retention period set by compliance requirements (7 years for SOX, 6 years for HIPAA).' },
    { name: 'Audit Query API & Dashboard', description: 'Provides filtered, paginated access to audit logs. Supports queries by actor, resource, action, time range, and outcome. Dashboard for security teams to investigate incidents. Export functionality for compliance auditors (CSV, PDF reports).' },
  ],
  dataModel: `erDiagram
    AUDIT_EVENT {
        string event_id PK
        string actor_id
        string actor_type
        string actor_ip
        string actor_user_agent
        string action
        string resource_type
        string resource_id
        json before_state
        json after_state
        enum outcome
        string error_message
        string session_id
        string request_id
        string hash
        string previous_hash
        timestamp created_at
    }
    AUDIT_CONFIG {
        string config_id PK
        string resource_type
        string[] audited_actions
        int retention_days
        boolean enabled
    }
    AUDIT_EXPORT {
        string export_id PK
        string requested_by
        json filters
        enum status
        string file_url
        timestamp created_at
        timestamp completed_at
    }
    AUDIT_CONFIG ||--o{ AUDIT_EVENT : governs
    AUDIT_EVENT ||--o{ AUDIT_EXPORT : included_in`,
  deepDive: [
    {
      title: 'Tamper-Proof Hash Chain',
      content: `Audit logs must be tamper-proof — if someone modifies a historical entry, it should be detectable.\n\n**Hash chain implementation**:\n1. For each audit event, compute: \`hash = SHA-256(event_id + actor + action + resource + timestamp + previous_hash)\`\n2. Store the hash alongside the event\n3. The first event in the chain uses a known seed value for previous_hash\n4. To verify integrity: recompute hashes from the beginning and compare with stored hashes\n\n**Verification**: Run a daily integrity check job that walks the entire chain and verifies each hash. Any break in the chain indicates tampering. Alert the security team immediately.\n\n**Anchoring**: Periodically publish the latest hash to an external system (a public blockchain, a separate write-once storage, or a third-party timestamping service). This prevents an attacker who gains database access from rewriting the entire chain.\n\n**Performance**: SHA-256 hashing is fast (~1 microsecond per entry). The chain verification job processes millions of entries per minute. Run incrementally — only verify entries since the last check.\n\n**Alternative**: Use a Merkle tree instead of a linear chain. Allows efficient proof that a specific entry exists in the log without verifying the entire chain. More complex but better for selective verification.`,
    },
    {
      title: 'What to Audit',
      content: `Not every operation needs auditing. Focus on security-relevant and compliance-required events.\n\n**Always audit**:\n- Authentication events: login, logout, failed login attempts, password changes, MFA enrollment\n- Authorization changes: role assignments, permission grants/revocations\n- Data access: reads of sensitive data (PII, financial records, health data)\n- Data modifications: creates, updates, deletes of business-critical records\n- Administrative actions: user management, configuration changes, feature flag toggles\n- API key and token management: creation, rotation, revocation\n\n**Consider auditing**:\n- Search queries on sensitive data (who searched for patient records?)\n- Export operations (who downloaded the customer list?)\n- Impersonation/admin access (admin viewed user's account)\n- Billing and payment operations\n\n**Skip** (use application logs instead):\n- Read-only access to non-sensitive data\n- Health checks and monitoring requests\n- Static asset requests\n- Internal service-to-service communication (unless accessing sensitive data)\n\n**Structured format**: Every audit entry should include: WHO (actor ID, actor type, IP, session), WHAT (action, resource type, resource ID), WHEN (timestamp, timezone), WHERE (IP, user agent, geolocation), and OUTCOME (success/failure, error details).`,
    },
    {
      title: 'Retention and Compliance',
      content: `Different regulations have different retention requirements:\n\n**SOX** (Sarbanes-Oxley): 7 years for financial audit trails\n**HIPAA**: 6 years for access logs to protected health information\n**GDPR**: Retain only as long as necessary (conflict with long retention!)\n**PCI DSS**: 1 year minimum, 3 months immediately accessible\n**SOC 2**: No specific retention, but auditors expect 12+ months\n\n**GDPR tension**: GDPR requires data minimization — don't keep data longer than necessary. But audit logs may contain PII (user names, emails, IP addresses). Solutions:\n- Anonymize/pseudonymize PII in audit logs after the active period\n- Keep audit logs but redact PII fields after the retention window\n- Document the legal basis for retaining audit logs (legitimate interest, legal obligation)\n\n**Tiered storage**:\n- **Hot** (0-90 days): Fast queryable store (PostgreSQL, Elasticsearch). Full detail.\n- **Warm** (90 days - 1 year): Compressed storage (S3 Standard). Queryable with some delay.\n- **Cold** (1-7+ years): Archive storage (S3 Glacier). Retrieved on demand for audits.\n\n**Immutability enforcement**: Use write-once storage (S3 Object Lock, WORM-compliant storage) for cold archives. Even database administrators cannot modify or delete archived audit logs. This is required for SOX compliance.`,
    },
  ],
  realWorldExamples: [
    { system: 'GitHub', approach: 'Enterprise audit log capturing all organization-level actions: repository access, member management, SSO events, and API access. Streamable to external SIEM systems via audit log streaming. Searchable via API with filters for actor, action, and time range.' },
    { system: 'AWS CloudTrail', approach: 'Records every API call made in an AWS account. Captures who (IAM principal), what (API action), which resource, and when. Logs stored in S3 with optional CloudWatch integration. Supports multi-region and organization-wide trails.' },
    { system: 'Datadog', approach: 'Audit Trail feature tracks all configuration changes, user actions, and API access within the Datadog platform. Every dashboard edit, monitor change, and access key creation is logged with full actor context. 90-day retention with export capability.' },
    { system: 'Stripe', approach: 'Complete audit trail of all API requests and dashboard actions. Every payment, refund, and configuration change is logged with the actor (API key or dashboard user), timestamp, and request details. Accessible via the dashboard and Events API.' },
  ],
  tradeoffs: [
    {
      decision: 'Application-level vs database-level auditing',
      pros: ['Application: rich business context, selective auditing', 'Database: captures ALL changes, cannot be bypassed', 'Both: belt-and-suspenders approach for critical systems'],
      cons: ['Application: can miss changes from direct DB access or other apps', 'Database: noisy, no business context, high volume', 'Both: more complexity, potential duplicate entries'],
    },
    {
      decision: 'Synchronous vs asynchronous audit logging',
      pros: ['Synchronous: guaranteed — if the operation succeeds, the audit entry exists', 'Asynchronous: no latency impact on the operation', 'Asynchronous: can batch writes for better throughput'],
      cons: ['Synchronous: adds latency to every audited operation', 'Asynchronous: small window where operation succeeds but audit entry is lost', 'Asynchronous: must handle queue failures and ensure delivery'],
    },
    {
      decision: 'Relational DB vs append-only log (Kafka) for audit storage',
      pros: ['Relational: easy querying with SQL, familiar tooling', 'Kafka: naturally append-only, immutable, high throughput', 'Relational: better for complex queries (joins, aggregations)'],
      cons: ['Relational: rows can be updated/deleted (must restrict access)', 'Kafka: harder to query (need to materialize into a queryable store)', 'Kafka: retention management is partition-based, less granular'],
    },
  ],
};
