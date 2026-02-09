import type { SystemDesign } from './types';

export const discord: SystemDesign = {
  slug: 'discord',
  name: 'Discord',
  tagline: 'Real-time voice, video, and text for communities at massive scale',
  category: 'messaging',
  tags: ['messaging', 'real-time', 'voice', 'gaming', 'communities', 'websocket', 'elixir'],
  overview: `Discord is a communication platform originally built for gaming communities, now serving 200M+ monthly active users across diverse interest groups. Its architecture is uniquely optimized for low-latency voice chat alongside text messaging, supporting millions of concurrent voice connections. Discord pioneered guild-based sharding, built its real-time infrastructure on Elixir/Erlang, and migrated its message storage from MongoDB to ScyllaDB to handle trillions of messages. The platform's bot ecosystem and rich presence system are integral architectural components.`,
  scale: {
    'Monthly active users': '200M+',
    'Concurrent voice connections': '10M+',
    'Messages per day': '4B+',
    'Servers (guilds)': '19M+ active',
  },
  requirements: {
    functional: [
      'Guild-based text channels with categories',
      'Low-latency voice and video channels',
      'Screen sharing and Go Live streaming',
      'Rich presence and activity status',
      'Bot framework and application commands',
      'Role-based permissions at guild, category, and channel level',
      'Direct messages and group DMs',
    ],
    nonFunctional: [
      'Ultra-low voice latency (<50ms codec-to-ear)',
      'High availability for voice infrastructure',
      'Horizontal scaling to millions of concurrent guilds',
      'Sub-second message delivery globally',
      'Support for guilds with 1M+ members',
      'Efficient storage for trillions of messages',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        DESK[Desktop App]
        WEB[Web App]
        MOB[Mobile App]
    end
    subgraph Edge["Edge Layer"]
        LB[Load Balancer]
        GWAPI[API Gateway]
        GWWS[WebSocket Gateway]
    end
    subgraph Services["Core Services"]
        GUILD[Guild Service]
        MSG[Message Service]
        VOICE[Voice Service]
        PRES[Presence Service]
        BOT[Bot Gateway]
        NOTIF[Push Service]
    end
    subgraph Voice["Voice Infrastructure"]
        SFU[SFU Servers]
        MEDIA[Media Relay]
    end
    subgraph Storage["Storage Layer"]
        SCYLLA[(ScyllaDB)]
        PG[(PostgreSQL)]
        REDIS[(Redis Cluster)]
        GCS[(Object Store)]
        MQ[(Message Broker)]
    end
    DESK & WEB & MOB --> LB
    LB --> GWAPI & GWWS
    GWWS --> GUILD & MSG & PRES
    GWAPI --> GUILD & MSG
    GUILD --> PG
    MSG --> SCYLLA
    MSG --> MQ
    VOICE --> SFU
    SFU --> MEDIA
    PRES --> REDIS
    BOT --> MQ
    NOTIF --> MQ
    MSG --> GCS`,
  components: [
    { name: 'WebSocket Gateway', description: 'Maintains persistent WebSocket connections for every online user. Built in Elixir for massive concurrency — each gateway node handles hundreds of thousands of connections. Events (messages, presence updates, typing indicators) are pushed to clients in real time.' },
    { name: 'Guild Service', description: 'Manages guild metadata, channels, roles, and permissions. Guilds are the primary sharding unit. Large guilds (100K+ members) use lazy member loading — the full member list is only fetched on demand.' },
    { name: 'Message Service', description: 'Handles message CRUD, attachments, embeds, and reactions. Messages are stored in ScyllaDB, partitioned by channel_id with a clustering key on message timestamp (Snowflake IDs) for efficient range queries.' },
    { name: 'Voice Service', description: 'Manages voice state, channel assignments, and coordinates with SFU (Selective Forwarding Unit) servers. Each voice channel runs on a dedicated SFU that selectively forwards audio/video streams to participants without transcoding.' },
    { name: 'SFU Servers', description: 'Selective Forwarding Units handle real-time media routing. Each SFU receives audio/video from participants and selectively forwards streams based on who is speaking (voice activity detection) and client bandwidth. Uses Opus codec for audio.' },
    { name: 'Presence Service', description: 'Tracks online/idle/DND/invisible status plus rich presence (currently playing, listening to Spotify, etc.). Backed by Redis Cluster with millions of presence entries updated via heartbeats.' },
    { name: 'Bot Gateway', description: 'Dedicated gateway for bot connections, separate from user gateways. Supports sharded bot connections for bots in thousands of guilds. Processes application commands (slash commands) and interaction events.' },
    { name: 'Push Service', description: 'Delivers mobile push notifications and manages notification settings per-channel, per-guild, and per-user. Batches and deduplicates notifications to avoid notification storms.' },
  ],
  dataModel: `erDiagram
    GUILD {
        bigint guild_id PK
        string name
        string icon_url
        bigint owner_id FK
        int member_count
    }
    CHANNEL {
        bigint channel_id PK
        bigint guild_id FK
        string name
        enum type
        bigint category_id
        int position
    }
    MESSAGE {
        bigint message_id PK
        bigint channel_id FK
        bigint author_id FK
        string content
        json embeds
        json attachments
        timestamp edited_at
    }
    MEMBER {
        bigint guild_id FK
        bigint user_id FK
        string nickname
        json role_ids
        timestamp joined_at
    }
    ROLE {
        bigint role_id PK
        bigint guild_id FK
        string name
        bigint permissions
        int position
    }
    GUILD ||--o{ CHANNEL : has
    GUILD ||--o{ MEMBER : has
    GUILD ||--o{ ROLE : defines
    CHANNEL ||--o{ MESSAGE : contains
    MEMBER ||--o{ MESSAGE : sends`,
  deepDive: [
    {
      title: 'Guild Sharding and Snowflake IDs',
      content: `Discord's core scaling strategy is **guild-based sharding**. Each guild (server) is assigned to a specific shard, and all operations for that guild are routed to the same set of backend processes.\n\n**Snowflake IDs**: Discord uses Twitter-style Snowflake IDs — 64-bit integers encoding a timestamp, worker ID, and sequence number. This provides globally unique, time-ordered, and roughly sortable IDs without coordination. Message IDs are Snowflakes, enabling efficient range queries (\"fetch messages before this ID\").\n\n**Gateway sharding**: For large bots, Discord requires bot connections to be sharded — each shard handles events for a subset of guilds. The shard for a guild is determined by \`(guild_id >> 22) % num_shards\`.\n\n**Large guilds**: Guilds with 100K+ members use **lazy member loading** — the client doesn't receive the full member list on connect. Instead, members are loaded on-demand as the user scrolls the member sidebar or types @mentions.`,
      diagram: `graph TB
    subgraph Shard_0["Shard 0"]
        G1[Guild A]
        G2[Guild B]
    end
    subgraph Shard_1["Shard 1"]
        G3[Guild C]
        G4[Guild D]
    end
    subgraph Shard_2["Shard 2"]
        G5[Guild E]
        G6[Guild F]
    end
    CLIENT[Bot Client] --> |guild_id % 3 = 0| Shard_0
    CLIENT --> |guild_id % 3 = 1| Shard_1
    CLIENT --> |guild_id % 3 = 2| Shard_2`,
    },
    {
      title: 'MongoDB to ScyllaDB Migration',
      content: `Discord stored messages in MongoDB for years but hit scaling limits as the platform grew to trillions of messages.\n\n**Problems with MongoDB**:\n- Hot partitions on popular channels caused latency spikes\n- Compaction storms during off-peak hours degraded performance\n- Memory-mapped storage engine was unpredictable under pressure\n\n**Why ScyllaDB?**: A C++ rewrite of Cassandra offering better tail latencies and more predictable performance. Its shard-per-core architecture eliminates coordination overhead.\n\n**Data model**: Messages are partitioned by \`channel_id\` with \`message_id\` (Snowflake) as the clustering key. This means fetching recent messages in a channel is a single partition scan in reverse order — extremely efficient.\n\n**Migration strategy**: Discord ran dual-writes to both MongoDB and ScyllaDB, validated consistency, then cut over reads. The migration handled trillions of messages with zero downtime.`,
    },
    {
      title: 'Voice Architecture and SFU Design',
      content: `Discord's voice is one of its biggest differentiators — it needs to feel instant, like sitting in a room together.\n\n**SFU model**: Each voice channel is assigned a Selective Forwarding Unit (SFU) server. The SFU receives encoded audio from all participants and selectively forwards each participant's stream to others. No transcoding happens server-side, keeping latency minimal.\n\n**Opus codec**: All voice is encoded using Opus at 64kbps (adjustable). Opus provides excellent quality at low bitrates and has near-zero algorithmic delay (~26.5ms).\n\n**Voice activity detection**: The SFU uses server-side VAD to determine who is speaking. Only active speakers' audio is forwarded at full rate — silent participants send minimal keep-alive frames.\n\n**Region selection**: Voice servers are deployed in 15+ regions. When a voice channel is created, the server closest to the majority of participants is selected. Users can override this with a per-channel region setting.\n\n**Priority speaker**: In large voice channels, admins can enable priority speaker mode, which uses server-side mixing to attenuate other participants' audio.`,
      diagram: `graph TB
    subgraph Participants
        P1[User A - Speaking]
        P2[User B - Silent]
        P3[User C - Speaking]
    end
    subgraph SFU["SFU Server"]
        VAD[Voice Activity Detection]
        FWD[Selective Forwarder]
    end
    P1 -->|Opus stream| VAD
    P2 -->|Silence frames| VAD
    P3 -->|Opus stream| VAD
    VAD --> FWD
    FWD -->|A+C streams| P1
    FWD -->|A+C streams| P2
    FWD -->|A+C streams| P3`,
    },
  ],
  tradeoffs: [
    {
      decision: 'Elixir/Erlang for WebSocket gateways',
      pros: ['Millions of concurrent connections per node', 'Fault-tolerant process model', 'Hot code upgrades for zero-downtime deploys'],
      cons: ['Smaller hiring pool than Go or Java', 'Garbage collection pauses at extreme scale', 'Interop overhead with non-BEAM services'],
    },
    {
      decision: 'ScyllaDB over MongoDB for messages',
      pros: ['Predictable tail latencies', 'Linear horizontal scaling', 'Efficient time-series queries via clustering keys'],
      cons: ['Less flexible query patterns than MongoDB', 'Eventual consistency requires careful modeling', 'Operational complexity of managing a Scylla cluster'],
    },
    {
      decision: 'SFU over MCU for voice',
      pros: ['No server-side transcoding — lower latency', 'Scales linearly with participants', 'Clients control their own decode/render'],
      cons: ['Client bandwidth scales with participant count', 'Heterogeneous network conditions harder to handle', 'Client must decode multiple streams simultaneously'],
    },
  ],
};
