import type { FeatureGuide } from './types';

export const websocketInfra: FeatureGuide = {
  slug: 'websocket-infrastructure',
  title: 'WebSocket Infrastructure',
  tagline: 'Persistent bidirectional connections at scale for real-time applications',
  category: 'real-time',
  tags: ['WebSocket', 'real-time', 'bidirectional', 'scaling', 'pub/sub'],
  problem: `Applications like chat, multiplayer games, collaborative editors, and live trading platforms require low-latency bidirectional communication between client and server. HTTP request-response adds too much overhead per interaction. WebSockets upgrade an HTTP connection to a persistent, full-duplex TCP channel — but scaling millions of concurrent WebSocket connections across a fleet of servers introduces challenges around connection management, message routing, state synchronization, and fault tolerance.`,
  approaches: [
    {
      name: 'Sticky Sessions with In-Process State',
      description: `Route each client to a specific server instance using sticky sessions (IP hash, cookie, or connection ID). Each server holds connection state in memory and routes messages locally. Simple to build but limited in scale and resilience.`,
      pros: [
        'Simplest implementation — no external state store needed',
        'Low latency for messages between users on the same server',
        'Easy to reason about — each server is self-contained',
      ],
      cons: [
        'Server failure drops all connections on that instance',
        'Cross-server messaging requires an additional routing layer',
        'Uneven load distribution as sticky sessions prevent rebalancing',
        'Horizontal scaling is limited by single-server capacity',
      ],
    },
    {
      name: 'Pub/Sub Backbone with Stateless Gateways',
      description: `WebSocket gateway servers are stateless beyond holding connections. All message routing goes through a central **pub/sub system** (Redis Pub/Sub, NATS, Kafka). When user A sends a message to user B, the gateway publishes to the bus, and the gateway holding B's connection delivers it.`,
      pros: [
        'Gateways are interchangeable — easy horizontal scaling',
        'Server failure only requires clients to reconnect to any instance',
        'Clean separation between connection management and business logic',
        'Supports broadcast, multicast, and unicast patterns',
      ],
      cons: [
        'Added latency from pub/sub hop (typically 1-5ms)',
        'Pub/sub becomes a critical dependency — must be highly available',
        'Fan-out to all gateways can be wasteful for unicast messages',
        'Message ordering across partitions requires careful design',
      ],
    },
    {
      name: 'Distributed Actor Model',
      description: `Each connection and each chat room/channel is modeled as an **actor** (Erlang/Elixir processes, Akka actors, Cloudflare Durable Objects). Actors communicate via message passing and can be distributed across nodes. The runtime handles location transparency and fault recovery.`,
      pros: [
        'Natural modeling of concurrent connections and rooms',
        'Built-in fault isolation — one actor crash doesn\'t affect others',
        'Location-transparent messaging simplifies cross-node routing',
        'Supervision trees enable automatic recovery',
      ],
      cons: [
        'Requires a runtime that supports the actor model',
        'Debugging distributed actors can be complex',
        'Mailbox overflow under load requires backpressure design',
        'Less common skillset in most engineering teams',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Clients
        C1[Web Client]
        C2[Mobile Client]
        C3[Desktop Client]
    end
    subgraph Edge["Edge Layer"]
        LB[Load Balancer<br/>Layer 4 / Sticky]
        WS1[WS Gateway 1]
        WS2[WS Gateway 2]
        WS3[WS Gateway 3]
    end
    subgraph Backbone["Message Backbone"]
        PS[Pub/Sub<br/>Redis / NATS]
        REG[Connection Registry]
    end
    subgraph Services["Backend Services"]
        API[REST API]
        AUTH[Auth Service]
        MSG[Message Service]
    end
    subgraph Storage
        DB[(Database)]
        CACHE[(Redis Cache)]
        MQ[(Message Queue)]
    end
    C1 & C2 & C3 -->|WS Upgrade| LB
    LB --> WS1 & WS2 & WS3
    WS1 & WS2 & WS3 <-->|Pub/Sub| PS
    WS1 & WS2 & WS3 --> REG
    WS1 & WS2 & WS3 --> AUTH
    MSG --> PS
    API --> MSG
    MSG --> DB
    MSG --> MQ
    WS1 & WS2 & WS3 --> CACHE`,
  components: [
    { name: 'WebSocket Gateway', description: 'Accepts WebSocket upgrades, manages connection lifecycle (open, message, ping/pong, close), authenticates on connect, and routes messages to/from the pub/sub backbone. Each instance handles 50K-500K concurrent connections depending on message throughput.' },
    { name: 'Connection Registry', description: 'Maps user IDs to gateway instances and connection IDs. Stored in Redis with TTL-based expiry. Used for targeted message delivery and presence tracking. Updated on connect/disconnect events.' },
    { name: 'Pub/Sub Backbone', description: 'Routes messages between gateway instances. Redis Pub/Sub for low-latency fan-out, or NATS/Kafka for higher durability. Supports channel-based subscriptions for rooms/topics and user-specific channels for DMs.' },
    { name: 'Message Service', description: 'Handles message persistence, history retrieval, and delivery receipts. Writes to the database and publishes events to the pub/sub bus. Decoupled from the gateway layer for independent scaling.' },
    { name: 'Auth Middleware', description: 'Validates JWT or session tokens during the WebSocket handshake. Rejects unauthorized connections before the upgrade completes. May also handle per-message authorization for sensitive operations.' },
    { name: 'Health & Heartbeat Manager', description: 'Sends periodic WebSocket ping frames to detect dead connections. Cleans up stale entries in the connection registry. Monitors gateway health and triggers graceful draining during deploys.' },
  ],
  dataModel: `erDiagram
    WS_CONNECTION {
        string connection_id PK
        string user_id FK
        string gateway_id
        string[] subscribed_channels
        timestamp connected_at
        timestamp last_ping
    }
    CHANNEL {
        string channel_id PK
        string type
        string name
        json metadata
        timestamp created_at
    }
    MESSAGE {
        string message_id PK
        string channel_id FK
        string sender_id FK
        string content
        string type
        timestamp created_at
    }
    CHANNEL_MEMBER {
        string channel_id FK
        string user_id FK
        enum role
        timestamp joined_at
    }
    CHANNEL ||--o{ MESSAGE : contains
    CHANNEL ||--o{ CHANNEL_MEMBER : has
    WS_CONNECTION }o--o{ CHANNEL : subscribes`,
  deepDive: [
    {
      title: 'Connection Lifecycle',
      content: `A WebSocket connection goes through several stages:\n\n1. **HTTP Upgrade** — Client sends an HTTP request with \`Upgrade: websocket\` header. Server validates auth token (from query param or cookie) and responds with 101 Switching Protocols.\n2. **Initialization** — Server registers the connection in the registry, subscribes to relevant pub/sub channels, and sends an initial state payload (unread counts, presence data).\n3. **Steady State** — Bidirectional message exchange. Server sends ping frames every 30s; client responds with pong. Messages are routed through the pub/sub backbone.\n4. **Graceful Close** — Either side sends a close frame with a status code. Server unsubscribes from channels, removes the registry entry, and notifies presence subscribers.\n5. **Abnormal Close** — Network failure or crash. Detected via ping timeout (typically 60-90s). Cleanup runs asynchronously, and the client reconnects with exponential backoff.\n\n**Reconnection**: Clients should implement exponential backoff with jitter (e.g., 1s, 2s, 4s + random 0-1s). On reconnect, send the last received message ID to enable server-side replay of missed messages.`,
      diagram: `sequenceDiagram
    participant C as Client
    participant LB as Load Balancer
    participant GW as WS Gateway
    participant R as Registry
    participant PS as Pub/Sub
    C->>LB: HTTP Upgrade + Auth Token
    LB->>GW: Forward (sticky)
    GW->>GW: Validate Token
    GW->>R: Register connection
    GW->>PS: Subscribe channels
    GW->>C: 101 Switching Protocols
    loop Steady State
        C->>GW: Send message
        GW->>PS: Publish
        PS->>GW: Deliver to recipients
        GW->>C: Receive message
    end
    C->>GW: Close frame
    GW->>R: Deregister
    GW->>PS: Unsubscribe`,
    },
    {
      title: 'Scaling to Millions of Connections',
      content: `**Per-server limits**: A single server with 16GB RAM can hold ~500K idle WebSocket connections (each consuming ~30KB). Active connections with message buffering need more memory. Key OS tunings:\n- Set \`ulimit -n\` to 1M+ for file descriptors\n- Tune \`net.core.somaxconn\` and TCP buffer sizes\n- Use epoll (Linux) or kqueue (BSD/macOS) for efficient I/O multiplexing\n\n**Horizontal scaling strategy**:\n1. **Add gateway instances** behind a Layer 4 load balancer\n2. **Shard pub/sub channels** to avoid hotspots (e.g., partition by channel ID hash)\n3. **Separate read and write paths** — message persistence can be async\n4. **Use connection draining** during deploys — stop accepting new connections, wait for existing ones to close or migrate\n\n**Cost optimization**: WebSocket connections are long-lived and consume resources even when idle. Consider:\n- Downgrading idle connections to SSE or long-polling\n- Implementing connection quotas per user\n- Using serverless WebSocket services (AWS API Gateway WebSocket, Cloudflare Durable Objects) for variable workloads`,
    },
    {
      title: 'Message Ordering and Delivery',
      content: `**Within a connection**: TCP guarantees in-order delivery. Messages sent on a single WebSocket connection arrive in order.\n\n**Across connections**: When a user reconnects to a different gateway, message ordering depends on the pub/sub system. Solutions:\n- Assign **sequence numbers** per channel. Clients buffer and reorder if needed.\n- Use **Kafka partitions** keyed by channel ID for strict per-channel ordering.\n- Accept **eventual consistency** for non-critical updates (typing indicators, presence).\n\n**Delivery guarantees**:\n- **At-most-once**: Default WebSocket behavior. Message lost if connection drops mid-delivery.\n- **At-least-once**: Persist messages before acknowledging to sender. Replay on reconnect using last-message-ID. Clients deduplicate using message IDs.\n- **Exactly-once**: Very expensive. Requires idempotent message processing and acknowledgment tracking. Rarely needed — at-least-once with client dedup is sufficient for most use cases.`,
    },
  ],
  realWorldExamples: [
    { system: 'Slack', approach: 'Uses WebSocket connections for real-time messaging with a Gateway Fleet pattern. Falls back to long-polling when WebSocket is unavailable. Messages are persisted in MySQL and routed via an internal message bus.' },
    { system: 'Discord', approach: 'Runs millions of concurrent WebSocket connections on Elixir/Erlang gateway nodes. Each guild (server) is managed by a process that handles message fan-out to connected members. Uses consistent hashing for guild-to-node assignment.' },
    { system: 'Figma', approach: 'WebSocket connections for real-time collaborative design. Uses a custom CRDT-based sync protocol over WebSocket for conflict-free concurrent editing. Each document session is managed by a dedicated server process.' },
    { system: 'Binance', approach: 'Streams real-time market data to millions of traders via WebSocket. Uses a tiered fan-out architecture: internal pub/sub → edge gateways → client connections. Supports per-symbol and aggregate streams.' },
  ],
  tradeoffs: [
    {
      decision: 'Layer 4 (TCP) vs Layer 7 (HTTP) load balancing',
      pros: ['L4 is simpler and lower latency for persistent connections', 'L7 enables smarter routing (auth-aware, header-based)', 'L4 avoids HTTP parsing overhead on every frame'],
      cons: ['L4 cannot inspect WebSocket frames for routing decisions', 'L7 adds latency but enables features like rate limiting at the LB', 'Sticky sessions at L4 can cause hotspots'],
    },
    {
      decision: 'Redis Pub/Sub vs Kafka for message backbone',
      pros: ['Redis Pub/Sub: ultra-low latency (~0.1ms), simple setup', 'Kafka: durable, replayable, ordered per partition', 'Redis: better for ephemeral real-time events'],
      cons: ['Redis Pub/Sub: fire-and-forget, no durability or replay', 'Kafka: higher latency (5-50ms), more operational complexity', 'Kafka: overkill for ephemeral events like typing indicators'],
    },
    {
      decision: 'Connection-per-user vs multiplexed connections',
      pros: ['One connection per user is simpler to implement and debug', 'Multiplexing reduces connection count for multi-tab users', 'SharedWorker or BroadcastChannel can share one WS across tabs'],
      cons: ['Multiple connections per user waste server resources', 'Multiplexing adds client-side complexity', 'SharedWorker support varies across browsers'],
    },
  ],
};
