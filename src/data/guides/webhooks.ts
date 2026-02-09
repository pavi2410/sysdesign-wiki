import type { FeatureGuide } from './types';

export const webhooks: FeatureGuide = {
  slug: 'webhooks',
  title: 'Webhooks',
  tagline: 'Reliable event delivery to external systems with retry, HMAC verification, and monitoring',
  category: 'reliability',
  tags: ['webhooks', 'events', 'HTTP', 'retry', 'HMAC', 'integration'],
  problem: `When events happen in your system (payment completed, order shipped, user signed up), external systems need to know. Webhooks push HTTP POST requests to customer-configured URLs when events occur. The challenge: the internet is unreliable. Customer endpoints go down, respond slowly, or return errors. You must ensure delivery with retries, prevent duplicate processing, secure payloads with signatures, and manage thousands of webhook endpoints with wildly varying reliability — all without letting slow endpoints back up your event pipeline.`,
  approaches: [
    {
      name: 'Synchronous Dispatch with Retry Queue',
      description: `Attempt delivery immediately when the event occurs. If the endpoint is down or slow, enqueue the webhook for retry. A background worker processes the retry queue with exponential backoff. Simple and low-latency for healthy endpoints.`,
      pros: [
        'Lowest latency for healthy endpoints — near-instant delivery',
        'Simple architecture — direct HTTP call + retry queue',
        'Easy to reason about delivery order',
      ],
      cons: [
        'Slow endpoints block the dispatch thread',
        'Must handle timeouts carefully (5-10 second max)',
        'Synchronous dispatch can overwhelm the event producer under load',
        'Retry queue can grow unbounded if many endpoints are down',
      ],
    },
    {
      name: 'Fully Async Queue-Based Dispatch',
      description: `All webhooks are enqueued immediately, and a fleet of workers processes the queue. Each worker picks a webhook, delivers it, and handles the result (success, retry, or dead-letter). The event producer never blocks on delivery. This is the standard pattern for high-volume webhook systems.`,
      pros: [
        'Event producer is completely decoupled from delivery',
        'Workers can be scaled independently based on queue depth',
        'Natural backpressure — queue absorbs spikes',
        'Easy to add rate limiting per endpoint',
      ],
      cons: [
        'Added latency from queue processing (1-5 seconds typical)',
        'More infrastructure to manage (queue + workers)',
        'Must handle queue ordering carefully for per-endpoint FIFO',
        'Monitoring and observability are more complex',
      ],
    },
    {
      name: 'Managed Webhook Service',
      description: `Use a managed service like **Svix**, **Hookdeck**, or **AWS EventBridge** to handle webhook delivery. Your system publishes events to the service, and it handles endpoint management, delivery, retries, and monitoring.`,
      pros: [
        'Zero infrastructure to manage',
        'Built-in retry, monitoring, and endpoint management UI',
        'Handles edge cases (endpoint rotation, signature verification)',
        'Customer-facing portal for managing webhook subscriptions',
      ],
      cons: [
        'Per-event pricing can be expensive at high volume',
        'Vendor dependency for a critical integration path',
        'Less control over delivery behavior and timing',
        'Data passes through a third party',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Events["Event Sources"]
        SVC1[Payment Service]
        SVC2[Order Service]
        SVC3[User Service]
    end
    subgraph Pipeline["Webhook Pipeline"]
        EB[Event Bus<br/>Kafka / SQS]
        WS[Webhook Service]
        SIGN[Signature<br/>Generator]
        DISPATCH[Dispatch<br/>Workers]
    end
    subgraph Delivery["Delivery"]
        EP1[Customer<br/>Endpoint A]
        EP2[Customer<br/>Endpoint B]
        EP3[Customer<br/>Endpoint C]
    end
    subgraph Storage
        DB[(Webhook Config<br/>& Event Log)]
        RQ[(Retry Queue)]
        DLQ[(Dead Letter<br/>Queue)]
    end
    subgraph Monitoring
        DASH[Delivery<br/>Dashboard]
        ALERT[Failure<br/>Alerts]
    end
    SVC1 & SVC2 & SVC3 --> EB
    EB --> WS
    WS --> SIGN
    WS --> DISPATCH
    DISPATCH --> EP1 & EP2 & EP3
    DISPATCH -->|Failed| RQ
    RQ --> DISPATCH
    DISPATCH -->|Max retries| DLQ
    DISPATCH --> DB
    DB --> DASH
    DASH --> ALERT`,
  components: [
    { name: 'Webhook Service', description: 'Core orchestrator that receives events from the event bus, resolves which endpoints are subscribed to each event type, generates signed payloads, and enqueues delivery jobs. Handles event filtering (only send "order.completed" events to endpoints subscribed to order events).' },
    { name: 'Signature Generator', description: 'Signs each webhook payload with HMAC-SHA256 using a per-endpoint secret key. The signature is sent in a header (e.g., X-Webhook-Signature). Customers verify the signature to ensure the webhook came from your system and wasn\'t tampered with.' },
    { name: 'Dispatch Workers', description: 'Pool of HTTP client workers that deliver webhooks. Each worker sends a POST request with the signed payload, enforces a timeout (5-10 seconds), and records the result. Handles connection pooling, TLS verification, and redirect following (with limits).' },
    { name: 'Retry Scheduler', description: 'Manages failed deliveries with exponential backoff: 1min, 5min, 30min, 2hr, 8hr, 24hr. Tracks attempt count per event. After max attempts (typically 5-8 over 24-72 hours), moves to the dead-letter queue and optionally notifies the endpoint owner.' },
    { name: 'Endpoint Manager', description: 'CRUD API for customers to register, update, and delete webhook endpoints. Stores the URL, subscribed event types, signing secret, and active/paused status. Supports endpoint verification (send a challenge and expect a specific response).' },
    { name: 'Delivery Dashboard', description: 'Customer-facing UI showing delivery history: timestamp, event type, response status code, response time, and payload. Allows customers to inspect failed deliveries, view request/response headers, and manually retry failed events.' },
  ],
  dataModel: `erDiagram
    WEBHOOK_ENDPOINT {
        string endpoint_id PK
        string customer_id FK
        string url
        string signing_secret
        string[] subscribed_events
        enum status
        int failure_count
        timestamp created_at
    }
    WEBHOOK_EVENT {
        string event_id PK
        string event_type
        json payload
        timestamp created_at
    }
    WEBHOOK_DELIVERY {
        string delivery_id PK
        string event_id FK
        string endpoint_id FK
        int attempt
        int response_status
        int response_time_ms
        string error_message
        enum status
        timestamp attempted_at
        timestamp next_retry_at
    }
    WEBHOOK_ENDPOINT ||--o{ WEBHOOK_DELIVERY : receives
    WEBHOOK_EVENT ||--o{ WEBHOOK_DELIVERY : delivered_via`,
  deepDive: [
    {
      title: 'HMAC Signature Verification',
      content: `Webhook payloads must be verified by the receiver to ensure authenticity and integrity.\n\n**Signing process** (your side):\n1. Generate a unique secret per endpoint (32+ random bytes, base64 encoded)\n2. For each delivery, compute: \`signature = HMAC-SHA256(secret, timestamp + "." + payload_body)\`\n3. Send headers: \`X-Webhook-Signature: t=1707100000,v1=abc123...\` and \`X-Webhook-Timestamp: 1707100000\`\n\n**Verification process** (customer side):\n1. Extract the timestamp and signature from the header\n2. Reject if timestamp is older than 5 minutes (replay protection)\n3. Compute expected signature: \`HMAC-SHA256(secret, timestamp + "." + raw_body)\`\n4. Compare with constant-time comparison to prevent timing attacks\n5. If match, process the webhook; if not, return 401\n\n**Including the timestamp** in the signature prevents replay attacks — an attacker can't re-send a captured webhook because the timestamp check will fail.\n\n**Secret rotation**: Support multiple active secrets per endpoint. When rotating, sign with the new secret and include signatures for both old and new secrets in the header. Customers verify against both during the rotation window.`,
    },
    {
      title: 'Retry Strategy and Circuit Breaking',
      content: `Not all failures are equal. The retry strategy should adapt to the failure type.\n\n**Retryable failures**:\n- Network timeout → retry with exponential backoff\n- 5xx server error → retry (server is temporarily down)\n- Connection refused → retry (server restarting)\n\n**Non-retryable failures**:\n- 4xx client error (except 429) → don't retry, the endpoint is misconfigured\n- Invalid URL → don't retry, notify the customer\n- TLS certificate error → don't retry, security issue\n- 429 Too Many Requests → retry, but respect the Retry-After header\n\n**Retry schedule**: 1min → 5min → 30min → 2hr → 8hr → 24hr (6 attempts over ~34 hours). After final failure, move to DLQ.\n\n**Circuit breaker per endpoint**: If an endpoint fails 10 consecutive deliveries, "open" the circuit — pause all deliveries to that endpoint. Periodically send a "health check" delivery. If it succeeds, close the circuit and resume. This prevents wasting resources on consistently failing endpoints.\n\n**Auto-disable**: After 72 hours of continuous failures, automatically disable the endpoint and notify the customer via email. Require them to re-enable manually after fixing the issue.`,
    },
    {
      title: 'Ordering and Idempotency',
      content: `**Delivery ordering**: Webhooks may arrive out of order due to retries and parallel dispatch. If order matters (e.g., order.created must arrive before order.shipped), options:\n- Include a sequence number in the payload. Receivers buffer and reorder.\n- Use per-endpoint FIFO queues (SQS FIFO, or single-worker-per-endpoint). Slower but ordered.\n- Accept out-of-order delivery and include enough state in each event for the receiver to reconcile.\n\n**Idempotency**: Receivers must handle duplicate deliveries. Include a unique \`event_id\` in every webhook. Receivers store processed event IDs and skip duplicates. Your documentation should clearly state that webhooks have at-least-once delivery semantics.\n\n**Event payload design**:\n- Include the full resource state ("fat events") so receivers don't need to call back to your API\n- OR include only the event type and resource ID ("thin events") and let receivers fetch the current state. Thin events are simpler but require an API call per webhook.\n- Best practice: include the changed fields and the event type. Receivers can process directly or fetch if they need more context.\n\n**Versioning**: Include an API version in the webhook payload or URL path. When you change the payload schema, maintain backward compatibility or introduce a new version. Customers choose which version they receive.`,
    },
  ],
  realWorldExamples: [
    { system: 'Stripe', approach: 'Industry-standard webhook implementation. HMAC-SHA256 signatures with timestamp. Retries over 72 hours with exponential backoff. Dashboard showing delivery attempts with full request/response details. Supports multiple webhook endpoints per account with event type filtering.' },
    { system: 'GitHub', approach: 'Webhook deliveries for repository events (push, PR, issue). Each delivery logged with request/response. Redeliver button in the UI. Supports both HMAC-SHA256 and HMAC-SHA1 signatures. Ping event sent on endpoint creation for verification.' },
    { system: 'Shopify', approach: 'Mandatory webhook verification for apps. Uses HMAC-SHA256 with the app secret. Webhooks are registered per-topic (orders/create, products/update). Automatic removal of endpoints that fail consistently for 19 days.' },
    { system: 'Svix', approach: 'Managed webhook service used by companies like Clerk and Liveblocks. Provides SDKs for both sending and receiving. Built-in endpoint management portal that can be embedded in your dashboard. Handles retry, signing, and delivery monitoring.' },
  ],
  tradeoffs: [
    {
      decision: 'Fat events (full payload) vs thin events (ID only)',
      pros: ['Fat: receiver doesn\'t need API callback, lower latency', 'Thin: smaller payload, always current state (not stale snapshot)', 'Fat: works even if your API is temporarily down'],
      cons: ['Fat: larger payloads, potential data consistency issues if state changes between event and delivery', 'Thin: requires an API call per webhook, adds load to your API', 'Fat: harder to handle schema changes without breaking receivers'],
    },
    {
      decision: 'Self-built vs managed webhook service (Svix)',
      pros: ['Self-built: full control, no per-event cost, data stays internal', 'Managed: faster to implement, battle-tested delivery infrastructure', 'Managed: customer-facing portal included'],
      cons: ['Self-built: significant engineering effort (3-6 weeks for a solid system)', 'Managed: per-event pricing, vendor dependency', 'Self-built: must handle all edge cases (retry, signing, circuit breaking)'],
    },
    {
      decision: 'Guaranteed ordering vs parallel dispatch',
      pros: ['Ordered: events arrive in logical sequence, simpler receiver logic', 'Parallel: much higher throughput, lower latency', 'Parallel with sequence numbers: best throughput, receivers reorder if needed'],
      cons: ['Ordered: per-endpoint FIFO limits throughput to one delivery at a time', 'Parallel: out-of-order delivery, receivers must handle reordering', 'Sequence numbers: adds complexity to both sender and receiver'],
    },
  ],
};
