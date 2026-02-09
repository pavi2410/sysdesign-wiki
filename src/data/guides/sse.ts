import type { FeatureGuide } from './types';

export const sse: FeatureGuide = {
  slug: 'server-sent-events',
  title: 'Server-Sent Events',
  tagline: 'One-way real-time streaming from server to client over HTTP',
  category: 'real-time',
  tags: ['real-time', 'streaming', 'HTTP', 'EventSource', 'push'],
  problem: `Many applications need to push updates from the server to the client in real time — live dashboards, notification feeds, stock tickers, build logs, and progress indicators. Traditional HTTP request-response requires the client to poll repeatedly, wasting bandwidth and adding latency. Server-Sent Events (SSE) provides a standardized, lightweight mechanism for the server to push a continuous stream of events to the client over a single long-lived HTTP connection.`,
  approaches: [
    {
      name: 'Native SSE with EventSource API',
      description: `Use the browser's built-in **EventSource** API to establish a persistent HTTP connection. The server responds with \`Content-Type: text/event-stream\` and writes events in the SSE wire format (\`data:\`, \`event:\`, \`id:\`, \`retry:\` fields). The browser automatically handles reconnection with the \`Last-Event-ID\` header.`,
      pros: [
        'Zero client-side dependencies — built into every modern browser',
        'Automatic reconnection with last-event-id resume',
        'Works through HTTP/2 multiplexing without extra connections',
        'Simple text-based protocol easy to debug with curl',
      ],
      cons: [
        'Unidirectional — server to client only',
        'Limited to ~6 concurrent connections per domain in HTTP/1.1',
        'No binary data support (text only)',
        'Some older proxies/load balancers may buffer or drop the connection',
      ],
    },
    {
      name: 'Long Polling Fallback',
      description: `Client sends a request, server holds it open until data is available or a timeout occurs, then responds. Client immediately re-requests. Simulates push semantics over standard HTTP. Useful as a fallback when SSE or WebSockets are blocked by corporate proxies.`,
      pros: [
        'Works everywhere — no special protocol support needed',
        'Compatible with all proxies and load balancers',
        'Simple to implement on any HTTP server',
      ],
      cons: [
        'Higher latency due to connection setup overhead per message',
        'More server resources — each poll is a new HTTP request',
        'Complex ordering and deduplication logic required',
        'No built-in reconnection or event ID mechanism',
      ],
    },
    {
      name: 'WebSocket for Bidirectional Needs',
      description: `If the application also needs client-to-server streaming (e.g. chat input, collaborative cursors), **WebSockets** provide full-duplex communication. However, for pure server-to-client push, SSE is simpler and sufficient.`,
      pros: [
        'Full-duplex — bidirectional communication',
        'Binary and text data support',
        'Lower per-message overhead after handshake',
      ],
      cons: [
        'More complex server implementation and scaling',
        'No automatic reconnection — must implement manually',
        'Requires sticky sessions or external pub/sub for horizontal scaling',
        'Overkill for unidirectional push scenarios',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Clients
        C1[Browser A]
        C2[Browser B]
        C3[Mobile App]
    end
    subgraph Edge["Edge Layer"]
        LB[Load Balancer<br/>HTTP/2]
        GW1[SSE Gateway 1]
        GW2[SSE Gateway 2]
    end
    subgraph Backend["Backend Services"]
        API[API Server]
        PS[Pub/Sub Bus<br/>Redis Streams]
        WK[Event Producer<br/>Workers]
    end
    subgraph Storage
        DB[(Database)]
        CACHE[(Redis Cache)]
    end
    C1 & C2 & C3 -->|EventSource| LB
    LB --> GW1 & GW2
    GW1 & GW2 -->|Subscribe| PS
    API --> PS
    WK --> PS
    API --> DB
    GW1 & GW2 --> CACHE`,
  components: [
    { name: 'SSE Gateway', description: 'Holds open HTTP connections and streams events to clients. Subscribes to a pub/sub bus (e.g. Redis Streams) for events. Each gateway instance manages thousands of concurrent connections using async I/O (Node.js streams, Go goroutines, etc.).' },
    { name: 'Pub/Sub Bus', description: 'Decouples event producers from SSE gateways. Redis Streams, NATS, or Kafka act as the fan-out layer. Each gateway subscribes to relevant channels/topics and forwards matching events to connected clients.' },
    { name: 'Event Producer', description: 'Backend services or workers that generate events (e.g. order status changes, new notifications). They publish structured events to the pub/sub bus with a channel key, event type, and payload.' },
    { name: 'Connection Registry', description: 'Tracks which users are connected to which gateway instance. Used for targeted delivery (send event only to user X) and connection lifecycle management (heartbeats, cleanup).' },
    { name: 'Load Balancer', description: 'Distributes incoming SSE connections across gateway instances. Must support long-lived HTTP connections and avoid premature timeouts. HTTP/2 multiplexing reduces the connection count issue.' },
  ],
  dataModel: `erDiagram
    SSE_CONNECTION {
        string connection_id PK
        string user_id FK
        string gateway_instance
        string channel
        string last_event_id
        timestamp connected_at
        timestamp last_heartbeat
    }
    EVENT {
        string event_id PK
        string channel
        string event_type
        string payload
        timestamp created_at
    }
    CHANNEL {
        string channel_id PK
        string name
        string description
        json metadata
    }
    CHANNEL ||--o{ EVENT : contains
    SSE_CONNECTION }o--|| CHANNEL : subscribes_to`,
  deepDive: [
    {
      title: 'SSE Wire Protocol',
      content: `The SSE protocol is remarkably simple — it's just a UTF-8 text stream over HTTP with a specific format:\n\n**Event format:**\n- \`data: <payload>\\n\\n\` — the event data (can span multiple lines)\n- \`event: <type>\\n\` — optional named event type (defaults to "message")\n- \`id: <id>\\n\` — optional event ID for resume\n- \`retry: <ms>\\n\` — optional reconnection interval in milliseconds\n- \`: comment\\n\` — comment line, useful for keep-alive heartbeats\n\n**Reconnection**: When the connection drops, the browser automatically reconnects and sends \`Last-Event-ID\` header. The server can use this to replay missed events — critical for reliability. Store events with sequential IDs and replay from the requested ID on reconnect.\n\n**Keep-alive**: Send a comment line (\`: heartbeat\\n\\n\`) every 15–30 seconds to prevent proxies and load balancers from closing idle connections.`,
    },
    {
      title: 'Scaling SSE Horizontally',
      content: `A single SSE gateway can hold tens of thousands of connections, but at scale you need multiple instances.\n\n**The fan-out problem**: When an event occurs, it must reach the correct gateway holding the target user's connection. Solutions:\n\n1. **Pub/Sub fan-out** — Every gateway subscribes to a Redis Pub/Sub channel or Kafka topic. Events are broadcast to all gateways, and each gateway filters locally. Simple but wasteful at large scale.\n2. **Targeted routing** — Maintain a connection registry mapping user→gateway. Publish events only to the specific gateway. More efficient but requires registry consistency.\n3. **Consistent hashing** — Route users to gateways deterministically. No registry needed, but rebalancing on scale events causes reconnections.\n\n**Memory management**: Each SSE connection consumes a file descriptor and a small memory buffer. Monitor open FD counts and set appropriate \`ulimit\` values. Use connection pooling for the pub/sub subscriber.`,
      diagram: `graph LR
    subgraph Producers
        P1[Service A]
        P2[Service B]
    end
    subgraph PubSub["Pub/Sub Layer"]
        R[Redis Streams]
    end
    subgraph Gateways
        G1[Gateway 1<br/>5K connections]
        G2[Gateway 2<br/>5K connections]
        G3[Gateway 3<br/>5K connections]
    end
    P1 & P2 --> R
    R --> G1 & G2 & G3`,
    },
    {
      title: 'Event Ordering and Delivery Guarantees',
      content: `SSE provides **at-most-once** delivery by default — if the client misses events during a disconnect, they're gone unless you implement replay.\n\n**At-least-once delivery**: Assign monotonically increasing IDs to events. Store recent events in a bounded buffer (e.g., Redis sorted set with TTL). On reconnect, replay from the client's \`Last-Event-ID\`. Accept that clients may receive duplicates and handle idempotently.\n\n**Ordering**: Events within a single SSE connection are ordered (TCP guarantees this). Across multiple channels or after reconnection, ordering depends on your event store. Use timestamps or sequence numbers for cross-channel ordering.\n\n**Backpressure**: If events produce faster than the client can consume, the TCP send buffer fills up. Monitor write buffer sizes and drop/batch events for slow clients rather than blocking the event loop.`,
    },
  ],
  realWorldExamples: [
    { system: 'GitHub', approach: 'Uses SSE for real-time updates on Actions workflow runs, deployment status, and Codespaces state changes.' },
    { system: 'Vercel', approach: 'Streams build logs and deployment progress to the dashboard via SSE, with automatic reconnection and log replay.' },
    { system: 'ChatGPT', approach: 'Streams LLM token-by-token responses via SSE, enabling the progressive text rendering experience.' },
    { system: 'Shopify', approach: 'Uses SSE for real-time inventory and order status updates in the merchant dashboard.' },
  ],
  tradeoffs: [
    {
      decision: 'SSE vs WebSocket for server push',
      pros: ['Simpler protocol — works over standard HTTP', 'Built-in reconnection and event ID resume', 'HTTP/2 multiplexing eliminates connection limits', 'Easier to cache and proxy'],
      cons: ['Unidirectional only', 'Text-only (no binary)', 'Less ecosystem tooling compared to WebSocket'],
    },
    {
      decision: 'Fan-out via pub/sub vs targeted routing',
      pros: ['Pub/sub is simpler — no connection registry needed', 'Naturally handles broadcast events', 'Gateway instances are stateless (aside from connections)'],
      cons: ['Wasteful at scale — every gateway processes every event', 'Targeted routing is more efficient but adds registry complexity', 'Registry must handle gateway failures gracefully'],
    },
    {
      decision: 'Event replay buffer size',
      pros: ['Larger buffer improves reliability during long disconnects', 'Small buffer reduces memory footprint per channel', 'TTL-based expiry prevents unbounded growth'],
      cons: ['Large buffers increase memory usage and replay time', 'Small buffers risk losing events during extended outages', 'Must balance reliability vs resource cost per use case'],
    },
  ],
};
