import type { SystemDesign } from './types';

export const whatsapp: SystemDesign = {
  slug: 'whatsapp',
  name: 'WhatsApp',
  tagline: 'End-to-end encrypted messaging at planetary scale',
  category: 'messaging',
  tags: ['messaging', 'real-time', 'encryption', 'erlang', 'XMPP'],
  overview: `WhatsApp is the world's most popular messaging application, serving over 2 billion users across 180+ countries. Its architecture prioritizes message delivery reliability, end-to-end encryption, and minimal latency. Built on an Erlang/FreeBSD stack, WhatsApp achieves remarkable efficiency — famously supporting 900 million users with just 50 engineers.`,
  scale: {
    'Monthly active users': '2B+',
    'Messages per day': '100B+',
    'Peak throughput': '~1.15M messages/second',
    'Media storage': 'Petabytes',
  },
  requirements: {
    functional: [
      'One-on-one and group messaging',
      'Media sharing (images, video, documents)',
      'Read receipts and online presence',
      'End-to-end encryption for all messages',
      'Message synchronization across devices',
      'Voice and video calling',
    ],
    nonFunctional: [
      'Ultra-low latency (<200ms message delivery)',
      'High availability (99.99% uptime)',
      'Strong consistency for message ordering',
      'Data privacy and encryption',
      'Minimal bandwidth usage',
      'Offline message queuing and delivery',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        A[Mobile App]
        B[Web Client]
        C[Desktop App]
    end
    subgraph Edge["Edge Layer"]
        LB[Load Balancer]
        GW[WebSocket Gateway]
    end
    subgraph Services["Core Services"]
        MS[Message Service]
        PS[Presence Service]
        GS[Group Service]
        NS[Notification Service]
        MDS[Media Service]
    end
    subgraph Storage["Storage Layer"]
        MQ[(Message Queue)]
        DB[(Mnesia DB)]
        MEDIA[(Object Store)]
        CACHE[(Redis Cache)]
    end
    A & B & C --> LB
    LB --> GW
    GW --> MS & PS
    MS --> MQ
    MS --> DB
    MS --> NS
    MS --> GS
    MDS --> MEDIA
    PS --> CACHE
    GW --> MDS`,
  components: [
    { name: 'WebSocket Gateway', description: 'Maintains persistent connections with clients using a custom XMPP-based protocol. Each server handles ~1M concurrent connections using Erlang lightweight processes.' },
    { name: 'Message Service', description: 'Core service handling message routing, storage, and delivery confirmation. Uses a store-and-forward pattern for offline users.' },
    { name: 'Presence Service', description: 'Tracks user online/offline status and last-seen timestamps. Uses an in-memory cache for sub-millisecond lookups.' },
    { name: 'Group Service', description: 'Manages group metadata, membership, and fan-out of messages to group participants. Groups support up to 1024 members.' },
    { name: 'Media Service', description: 'Handles upload, encryption, compression, and CDN distribution of media files. Media is encrypted client-side before upload.' },
    { name: 'Notification Service', description: 'Delivers push notifications via APNs/FCM when recipients are offline or the app is backgrounded.' },
  ],
  dataModel: `erDiagram
    USER {
        string user_id PK
        string phone_number UK
        string display_name
        string avatar_url
        timestamp last_seen
        boolean online
    }
    MESSAGE {
        string message_id PK
        string sender_id FK
        string recipient_id FK
        string content_encrypted
        string media_url
        enum status
        timestamp created_at
    }
    GROUP {
        string group_id PK
        string name
        string avatar_url
        string created_by FK
    }
    GROUP_MEMBER {
        string group_id FK
        string user_id FK
        enum role
    }
    USER ||--o{ MESSAGE : sends
    USER ||--o{ MESSAGE : receives
    USER ||--o{ GROUP_MEMBER : belongs_to
    GROUP ||--o{ GROUP_MEMBER : has`,
  deepDive: [
    {
      title: 'Message Delivery Flow',
      content: `When User A sends a message to User B, the following sequence occurs:\n\n1. **Client encrypts** the message using the Signal Protocol (Double Ratchet Algorithm)\n2. **WebSocket connection** transmits the encrypted payload to the gateway\n3. **Message Service** persists the message and checks recipient status\n4. If **online**: message is pushed through B's WebSocket connection immediately\n5. If **offline**: message is queued and a push notification is sent via APNs/FCM\n6. **Delivery receipt** flows back to sender when B receives the message\n7. **Read receipt** flows back when B opens the conversation\n\nMessages are stored on the server only until delivered (transient storage). Once the recipient acknowledges receipt, messages are deleted from server storage, ensuring privacy.`,
      diagram: `sequenceDiagram
    participant A as User A
    participant GW as Gateway
    participant MS as Msg Service
    participant Q as Queue
    participant NS as Push
    participant GW2 as Gateway
    participant B as User B
    A->>GW: Encrypted message
    GW->>MS: Route message
    MS->>Q: Persist to queue
    alt User B is online
        MS->>GW2: Forward message
        GW2->>B: Deliver message
        B->>GW2: Delivery ACK
        GW2->>MS: Confirm delivery
        MS->>Q: Remove from queue
        MS->>GW: Delivery receipt
        GW->>A: Delivered
    else User B is offline
        MS->>NS: Send push notification
        NS->>B: Push notification
    end`,
    },
    {
      title: 'End-to-End Encryption',
      content: `WhatsApp uses the **Signal Protocol** for end-to-end encryption, ensuring that only the communicating users can read messages. The server never has access to plaintext content.\n\n**Key Exchange**: Uses the X3DH (Extended Triple Diffie-Hellman) key agreement protocol. Each user generates an identity key pair, a signed pre-key, and a set of one-time pre-keys.\n\n**Message Encryption**: The Double Ratchet Algorithm provides forward secrecy and break-in recovery. Each message uses a unique encryption key, so compromising one key doesn't expose other messages.\n\n**Group Encryption**: Uses the Sender Keys protocol. Each group member generates a sender key, distributes it via pairwise encrypted channels, then uses it for efficient group message encryption.`,
    },
    {
      title: 'Erlang/OTP Architecture',
      content: `WhatsApp's backend is built on **Erlang/OTP**, chosen for its exceptional concurrency model and fault tolerance.\n\n**Why Erlang?**\n- **Lightweight processes**: Each connection is an Erlang process (~2KB memory), enabling millions of concurrent connections per server\n- **Fault isolation**: Process crashes don't affect other connections (let-it-crash philosophy)\n- **Hot code loading**: Deployments happen without disconnecting users\n- **Built-in distribution**: Erlang nodes communicate seamlessly in a cluster\n\n**Mnesia Database**: WhatsApp uses Mnesia, Erlang's built-in distributed database, for storing message queues and user metadata. It provides in-memory speed with optional disk persistence.\n\nA single WhatsApp server can handle **~2 million concurrent connections**, making it one of the most efficient messaging architectures ever built.`,
    },
  ],
  tradeoffs: [
    {
      decision: 'Erlang/OTP over Java/C++',
      pros: ['Exceptional concurrency with lightweight processes', 'Built-in fault tolerance', 'Hot code swapping for zero-downtime deploys'],
      cons: ['Smaller talent pool', 'Limited ecosystem compared to JVM', 'Performance ceiling for CPU-intensive tasks'],
    },
    {
      decision: 'Transient message storage',
      pros: ['Enhanced privacy — messages deleted after delivery', 'Reduced storage costs', 'Compliance with privacy regulations'],
      cons: ['No server-side message history', 'Multi-device sync is more complex', 'Backup responsibility shifts to client'],
    },
    {
      decision: 'Custom XMPP-based protocol',
      pros: ['Optimized for mobile bandwidth', 'Fine-grained control over message semantics', 'Efficient binary encoding'],
      cons: ['Not standards-compliant', 'Higher development cost', 'Client library maintenance burden'],
    },
  ],
};
