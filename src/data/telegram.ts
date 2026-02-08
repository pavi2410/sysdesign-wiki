import type { SystemDesign } from './types';

export const telegram: SystemDesign = {
  slug: 'telegram',
  name: 'Telegram',
  tagline: 'Cloud-native messaging with unlimited storage and channels',
  category: 'messaging',
  tags: ['messaging', 'cloud', 'channels', 'MTProto', 'distributed'],
  overview: `Telegram is a cloud-based messaging platform serving over 800 million monthly active users. Unlike WhatsApp, Telegram stores all messages in the cloud, enabling seamless multi-device access. It supports massive group chats (up to 200K members), channels with unlimited subscribers, and a rich bot platform. Its custom MTProto protocol is optimized for speed and reliability across unreliable networks.`,
  scale: {
    'Monthly active users': '800M+',
    'Messages per day': '~15B',
    'Concurrent connections': 'Millions',
    'Storage model': 'Full cloud history',
  },
  requirements: {
    functional: [
      'Cloud-based messaging with full history sync',
      'Channels with unlimited subscribers',
      'Groups up to 200,000 members',
      'Bot platform and Bot API',
      'Secret chats with E2E encryption',
      'File sharing up to 2GB per file',
    ],
    nonFunctional: [
      'Multi-datacenter distribution for resilience',
      'Fast delivery across unreliable networks',
      'Seamless sync across unlimited devices',
      'Scalable fan-out for million-subscriber channels',
      'High availability across geopolitical regions',
      'Efficient binary protocol (MTProto)',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        A[Mobile Apps]
        B[Desktop Apps]
        C[Web Apps]
        D[Bot Clients]
    end
    subgraph Edge["Edge Layer"]
        AP[Access Points]
        LB[Load Balancer]
    end
    subgraph Core["Core Infrastructure"]
        AUTH[Auth Service]
        MSG[Message Router]
        CH[Channel Service]
        GRP[Group Service]
        BOT[Bot API]
        SYNC[Sync Service]
    end
    subgraph Storage["Distributed Storage"]
        KV[(Distributed KV)]
        FS[(File Store)]
        IDX[(Search Index)]
        CACHE[(Cache)]
    end
    subgraph DC["Multi-DC"]
        DC1[Americas]
        DC2[Europe]
        DC3[Asia]
    end
    A & B & C & D --> AP
    AP --> LB
    LB --> AUTH & MSG
    MSG --> CH & GRP & SYNC
    BOT --> MSG
    MSG --> KV & CACHE
    CH --> KV
    DC1 <--> DC2 <--> DC3`,
  components: [
    { name: 'Access Points', description: 'Geographically distributed entry points that establish MTProto connections. Clients connect to the nearest access point for minimal latency.' },
    { name: 'Message Router', description: 'Core routing engine that determines the destination datacenter and server for each message. Handles both 1:1 and fan-out delivery.' },
    { name: 'Channel Service', description: 'Manages channels with potentially millions of subscribers. Uses an efficient lazy-loading approach — messages are stored once and fetched on demand.' },
    { name: 'Sync Service', description: 'Maintains a sequence of updates per user across all their devices. Each device tracks its own sync point and fetches missed updates on reconnection.' },
    { name: 'Bot API Service', description: 'HTTP-based API layer for third-party bots. Translates between the Bot API (JSON/HTTP) and internal MTProto-based communication.' },
    { name: 'Media Service', description: 'Handles upload, storage, and delivery of files up to 2GB. Files are split into parts and distributed across the storage cluster.' },
  ],
  dataModel: `erDiagram
    USER {
        bigint user_id PK
        string phone_number
        string username
        string first_name
    }
    CHAT {
        bigint chat_id PK
        enum chat_type
        string title
        int member_count
    }
    MESSAGE {
        bigint message_id PK
        bigint chat_id FK
        bigint sender_id FK
        string text
        timestamp date
    }
    CHANNEL {
        bigint channel_id PK
        string title
        string username
        int subscriber_count
    }
    USER_DEVICE {
        bigint device_id PK
        bigint user_id FK
        bigint pts
        bigint qts
    }
    USER ||--o{ MESSAGE : sends
    CHAT ||--o{ MESSAGE : contains
    USER ||--o{ USER_DEVICE : has
    CHANNEL ||--o{ MESSAGE : broadcasts`,
  deepDive: [
    {
      title: 'MTProto Protocol',
      content: `Telegram uses its custom **MTProto** protocol, designed for speed and reliability on mobile networks.\n\n**Key Design Decisions:**\n- **Binary encoding**: Messages use TL (Type Language) serialization, more compact than JSON/Protobuf\n- **Transport flexibility**: Works over TCP, HTTP, and UDP with automatic fallback\n- **Encryption layers**: Server-client encryption (default) and optional E2E (Secret Chats)\n- **Built-in ACK**: Automatic resend for lost packets\n\n**Connection Optimization:**\n- Persistent TCP connections with keepalive\n- Request pipelining — multiple RPC calls over a single connection\n- Compression of large payloads using gzip\n- Quick reconnection with session resumption (no full handshake)\n\nMTProto achieves significantly faster message delivery than HTTPS-based alternatives, especially on high-latency mobile connections.`,
      diagram: `sequenceDiagram
    participant C as Client
    participant AP as Access Point
    participant DC as Datacenter
    participant S as Storage
    Note over C,AP: MTProto Handshake
    C->>AP: req_pq_multi
    AP->>C: res_pq
    C->>AP: req_DH_params
    AP->>C: server_DH_params_ok
    C->>AP: set_client_DH_params
    AP->>C: auth_key established
    Note over C,S: Message Send
    C->>AP: msg_container [encrypted]
    AP->>DC: Route to user DC
    DC->>S: Persist message
    DC->>AP: new_message update
    AP->>C: msg_ack + updates`,
    },
    {
      title: 'Multi-Datacenter Architecture',
      content: `Telegram operates across **multiple datacenters** worldwide, with each user assigned to a "home" datacenter.\n\n**Datacenter Assignment:**\n- Users are assigned to the nearest DC at registration\n- Each DC is a complete, autonomous unit with its own storage\n- User data lives in their home DC\n\n**Cross-DC Communication:**\n- When User A (DC1) messages User B (DC3), the message routes through a high-speed inter-DC backbone\n- Media files may be cached in non-home DCs for faster access\n- Secret chats require both participants' DCs to coordinate\n\n**Benefits:**\n- **Data sovereignty**: Users' data stays in their assigned region\n- **Latency optimization**: Most operations happen within a single DC\n- **Resilience**: DC failures are isolated\n- **Regulatory compliance**: Data kept in specific geographic regions`,
    },
    {
      title: 'Channel Fan-Out Strategy',
      content: `Channels are Telegram's broadcast mechanism, with some having **millions of subscribers**. Telegram uses a **read-optimized** approach:\n\n**Storage Model:**\n- Channel messages are stored **once** in the channel's message history\n- Subscribers do NOT get individual copies (no write amplification)\n- When a subscriber opens a channel, messages are fetched from the shared store\n\n**Notification Fan-Out:**\n- Only notifications (not full messages) are fanned out\n- Notifications are batched and sent in bulk\n- Muted channels skip notification delivery entirely\n\n**Read State Tracking:**\n- Each subscriber has a simple pointer (last_read_msg_id) per channel\n- Unread count = latest_msg_id - last_read_msg_id\n- O(1) per subscriber, no per-user message copies\n\nThis allows channels to scale to millions of subscribers without proportional storage or write costs.`,
    },
  ],
  tradeoffs: [
    {
      decision: 'Cloud storage vs. E2E encryption by default',
      pros: ['Seamless multi-device sync', 'Full message history search', 'No backup hassles'],
      cons: ['Server can theoretically access messages', 'Privacy concerns', 'Larger storage infrastructure needed'],
    },
    {
      decision: 'Custom MTProto vs. standard protocols',
      pros: ['Optimized for mobile networks', 'Lower latency than HTTPS', 'Built-in reconnection'],
      cons: ['Security scrutiny from custom crypto', 'Higher barrier for third-party clients', 'Complex maintenance'],
    },
    {
      decision: 'User-DC assignment model',
      pros: ['Data locality for fast operations', 'Simple data ownership model', 'Geographic compliance'],
      cons: ['Cross-DC messages have higher latency', 'DC migration is complex', 'Uneven load distribution possible'],
    },
  ],
};
