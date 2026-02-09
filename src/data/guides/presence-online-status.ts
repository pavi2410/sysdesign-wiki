import type { FeatureGuide } from './types';

export const presenceOnlineStatus: FeatureGuide = {
  slug: 'presence-online-status',
  title: 'Presence & Online Status',
  tagline: 'Distributed heartbeat tracking to show who is online in real time',
  category: 'real-time',
  tags: ['presence', 'real-time', 'heartbeat', 'distributed', 'status'],
  problem: `Messaging apps, collaboration tools, and social platforms need to show whether users are currently online, idle, or offline. This seems simple but becomes a hard distributed systems problem at scale — millions of users constantly transitioning between states, each state change needing to fan out to potentially thousands of subscribers (friends, team members, channel participants). The system must handle network partitions, clock skew, and the inherent unreliability of client heartbeats while keeping the status reasonably accurate and the infrastructure cost manageable.`,
  approaches: [
    {
      name: 'Heartbeat with TTL-Based Expiry',
      description: `Clients send periodic heartbeat signals (every 15-30 seconds). The server stores each user's last heartbeat timestamp in a fast key-value store with a TTL slightly longer than the heartbeat interval. If the key expires, the user is considered offline. Simple, stateless, and easy to scale.`,
      pros: [
        'Extremely simple to implement — just SET with TTL',
        'Stateless servers — any server can process any heartbeat',
        'Naturally handles crashes — TTL expires automatically',
        'Low per-user memory footprint (~100 bytes per user)',
      ],
      cons: [
        'Offline detection is delayed by the TTL window (30-60s)',
        'Heartbeats generate constant write traffic even for idle users',
        'No distinction between "offline" and "app backgrounded"',
        'Fan-out of status changes must be handled separately',
      ],
    },
    {
      name: 'Connection-Based Presence',
      description: `Tie presence to the WebSocket or SSE connection lifecycle. When a connection opens, mark the user online; when it closes, mark them offline. Eliminates heartbeat overhead but requires reliable disconnect detection.`,
      pros: [
        'Instant online/offline detection — no polling delay',
        'No heartbeat traffic overhead',
        'Naturally integrates with WebSocket infrastructure',
        'Can detect per-device presence (phone vs desktop)',
      ],
      cons: [
        'Depends on reliable disconnect detection (TCP FIN vs timeout)',
        'Network glitches cause false offline events',
        'Requires a connection registry tightly coupled to presence',
        'Server crashes orphan connections until TCP timeout',
      ],
    },
    {
      name: 'Hybrid: Connection + Heartbeat',
      description: `Use connection events for instant transitions and heartbeats as a safety net. Mark online on connect, start a heartbeat timer. If heartbeats stop (but connection isn't explicitly closed), transition to "idle" or "away" before marking offline. Most production systems use this approach.`,
      pros: [
        'Fast detection on connect/disconnect',
        'Heartbeat catches silent disconnects and idle detection',
        'Supports rich status: online → idle → away → offline',
        'Resilient to partial failures',
      ],
      cons: [
        'More complex state machine per user',
        'Still has some heartbeat overhead (can be reduced with longer intervals)',
        'Must reconcile connection events with heartbeat state',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Clients
        C1[Web App]
        C2[Mobile App]
        C3[Desktop App]
    end
    subgraph Edge["Connection Layer"]
        WS1[WS Gateway 1]
        WS2[WS Gateway 2]
    end
    subgraph Presence["Presence Service"]
        PS1[Presence Worker 1]
        PS2[Presence Worker 2]
    end
    subgraph Storage["Storage Layer"]
        REDIS[(Redis Cluster<br/>Presence Store)]
        PUB[Redis Pub/Sub<br/>Status Changes]
    end
    subgraph Subscribers["Status Subscribers"]
        SUB1[Friend List Service]
        SUB2[Channel Members]
        SUB3[Analytics]
    end
    C1 & C2 & C3 --> WS1 & WS2
    WS1 & WS2 -->|Heartbeat / Connect / Disconnect| PS1 & PS2
    PS1 & PS2 --> REDIS
    PS1 & PS2 --> PUB
    PUB --> SUB1 & SUB2 & SUB3
    SUB1 & SUB2 --> WS1 & WS2`,
  components: [
    { name: 'Presence Worker', description: 'Processes heartbeat events, connection opens, and disconnects. Updates the presence store (Redis) and publishes status change events to the pub/sub bus. Runs as a stateless service behind the WebSocket gateways.' },
    { name: 'Presence Store (Redis)', description: 'Stores per-user presence state: status, last heartbeat timestamp, connected devices, and gateway ID. Uses Redis hashes with TTL for automatic expiry. Supports atomic operations for multi-device presence aggregation.' },
    { name: 'Status Fan-Out Service', description: 'Subscribes to status change events and determines which users need to be notified. Queries the social graph (friends, channel members) and pushes updates through the appropriate WebSocket gateways. Batches updates to avoid thundering herd on mass reconnects.' },
    { name: 'Presence Query API', description: 'REST/gRPC endpoint for bulk presence queries. Fetches the status of multiple users in a single call (e.g., "get status of all 50 people in this channel"). Uses Redis MGET for efficient batch reads.' },
    { name: 'Idle Detection', description: 'Client-side component that tracks user activity (mouse movement, key presses, touch events). Reports activity status to the server which transitions presence between active, idle, and away states.' },
  ],
  dataModel: `erDiagram
    PRESENCE {
        string user_id PK
        enum status
        timestamp last_heartbeat
        timestamp last_active
        string[] connected_devices
        string[] gateway_ids
        json custom_status
    }
    PRESENCE_SUBSCRIPTION {
        string subscriber_id FK
        string target_user_id FK
        string context
    }
    PRESENCE_EVENT {
        string event_id PK
        string user_id FK
        enum old_status
        enum new_status
        string trigger
        timestamp created_at
    }
    PRESENCE ||--o{ PRESENCE_EVENT : generates
    PRESENCE ||--o{ PRESENCE_SUBSCRIPTION : watched_by`,
  deepDive: [
    {
      title: 'Multi-Device Presence Aggregation',
      content: `When a user has multiple devices (phone, laptop, tablet), presence must be aggregated:\n\n**Rules:**\n- User is **online** if ANY device is active\n- User is **idle** if ALL devices are idle\n- User is **offline** if ALL devices are disconnected\n- User's status shows the **most active** device state\n\n**Implementation**: Store a set of connected devices per user in Redis (SADD/SREM). On any device event, compute the aggregate status:\n\n1. Device connects → SADD user:devices device_id, SET user:status online\n2. Device heartbeat → UPDATE user:device:{id}:last_seen\n3. Device disconnects → SREM user:devices device_id\n4. If device set empty → SET user:status offline\n5. If all devices idle → SET user:status idle\n\nUse Redis transactions (MULTI/EXEC) to make aggregate computation atomic.`,
    },
    {
      title: 'Fan-Out Optimization',
      content: `The biggest scalability challenge is fan-out: when a user's status changes, who needs to know?\n\n**Naive approach**: Notify all friends/contacts. For a user with 500 friends, each status change triggers 500 push notifications. If 100K users come online in a minute (morning rush), that's 50M notifications/minute.\n\n**Optimizations:**\n- **Lazy fan-out**: Only notify users who currently have the status-changed user visible (open chat, visible friend list). Track "active subscriptions" rather than the full social graph.\n- **Batching**: Buffer status changes for 2-5 seconds and send batched updates. Reduces message count dramatically during mass online/offline events.\n- **Tiered updates**: Immediate notification for active conversations, batched for friend list, dropped for background contexts.\n- **Bloom filter**: Use a Bloom filter to quickly check if any online user is subscribed to updates for a given user, avoiding unnecessary fan-out queries.\n\nWhatsApp famously limits presence to one-on-one chat views — you only see someone's status when you're actively in a conversation with them. This reduces fan-out from O(friends) to O(1).`,
    },
    {
      title: 'Consistency vs Availability',
      content: `Presence is an inherently **eventually consistent** system. Trade strict accuracy for availability and performance.\n\n**Acceptable inaccuracy**: It's okay if a user appears online for 30-60 seconds after closing the app. It's NOT okay if a user appears offline while actively chatting.\n\n**Design principles:**\n- **Bias toward online**: If uncertain, show online. False positives (showing online when offline) are less harmful than false negatives.\n- **Exponential backoff on offline**: Don't immediately show offline on a missed heartbeat — wait for 2-3 missed intervals. Network is unreliable.\n- **Local caching**: Cache presence state on the client for 10-30 seconds. Don't re-query on every screen load.\n- **Graceful degradation**: If the presence service is down, show "status unavailable" rather than "offline" for everyone.\n\n**Consistency across regions**: For multi-region deployments, replicate presence data asynchronously. Accept that users in different regions may see slightly different presence states for a brief window.`,
    },
  ],
  realWorldExamples: [
    { system: 'WhatsApp', approach: 'Shows "last seen" timestamps and "online" status only in 1:1 chat views. Presence is scoped to active conversations to minimize fan-out. Uses Erlang presence tracking tied to XMPP connection lifecycle.' },
    { system: 'Slack', approach: 'Shows green dot (active), hollow circle (away), and custom status. Uses a hybrid heartbeat + connection approach with 30-second heartbeat intervals. Batches presence updates to channels.' },
    { system: 'Discord', approach: 'Rich presence system showing online, idle, DND, invisible, and custom activity (playing a game, listening on Spotify). Presence is managed per-guild and distributed across Elixir nodes.' },
    { system: 'Microsoft Teams', approach: 'Integrates with calendar and Outlook to automatically set status (In a meeting, Presenting). Uses Azure SignalR for real-time presence distribution across large organizations.' },
  ],
  tradeoffs: [
    {
      decision: 'Heartbeat interval: 15s vs 30s vs 60s',
      pros: ['Shorter interval = faster offline detection', 'Longer interval = less traffic and server load', '30s is the most common sweet spot'],
      cons: ['15s: doubles write traffic vs 30s, marginal accuracy gain', '60s: user appears online for up to a minute after leaving', 'Must tune per-platform (mobile needs longer to save battery)'],
    },
    {
      decision: 'Eager fan-out vs lazy subscription',
      pros: ['Eager: instant status updates for all contacts', 'Lazy: dramatically lower infrastructure cost', 'Lazy: naturally scales with active users, not total users'],
      cons: ['Eager: O(friends) messages per status change', 'Lazy: slight delay when opening a chat/contact list', 'Lazy: more complex — must track active subscriptions'],
    },
    {
      decision: 'Redis TTL vs explicit offline events',
      pros: ['TTL: automatic cleanup, no leak risk', 'Explicit: instant offline detection on graceful close', 'Hybrid: explicit events + TTL safety net is most reliable'],
      cons: ['TTL-only: delayed offline detection by TTL duration', 'Explicit-only: missed events on crashes leak "online" ghosts', 'Hybrid: more complex state management'],
    },
  ],
};
