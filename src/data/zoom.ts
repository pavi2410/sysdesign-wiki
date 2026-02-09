import type { SystemDesign } from './types';

export const zoom: SystemDesign = {
  slug: 'zoom',
  name: 'Zoom',
  tagline: 'Proprietary multimedia routing for reliable video conferencing at any scale',
  category: 'video',
  tags: ['video', 'conferencing', 'real-time', 'SFU', 'proprietary-codec', 'hybrid-cloud'],
  overview: `Zoom is the world's most widely used video conferencing platform, serving 300M+ daily meeting participants. Unlike browser-based competitors, Zoom uses a native desktop client with proprietary media codecs and a globally distributed Multimedia Router (MMR) infrastructure. Its architecture is purpose-built for video quality, supporting up to 1,000 video participants and 49 simultaneous on-screen feeds. Zoom differentiates through its hybrid cloud architecture (supporting on-premise deployments for enterprises), breakout rooms, and a telephony-grade reliability SLA.`,
  scale: {
    'Daily meeting participants': '300M+',
    'Peak concurrent meetings': '~25M',
    'Max video participants': '1,000',
    'Data centers': '18+ worldwide',
  },
  requirements: {
    functional: [
      'HD video conferencing with gallery and speaker views',
      'Screen sharing with annotation',
      'Breakout rooms with automatic/manual assignment',
      'Virtual backgrounds and touch-up appearance',
      'Waiting room and host controls',
      'Meeting recording (local and cloud)',
      'Zoom Phone (PSTN integration) and Zoom Rooms',
    ],
    nonFunctional: [
      'Low latency (<150ms glass-to-glass)',
      'High video quality up to 1080p',
      'Reliability — 99.999% uptime SLA',
      'On-premise deployment option for regulated industries',
      'Bandwidth efficiency on constrained networks',
      'Support for 1,000+ participants per meeting',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        DESK[Desktop Client]
        WEB[Web Client]
        MOB[Mobile Client]
        ROOM[Zoom Room]
    end
    subgraph Edge["Edge Infrastructure"]
        ZPE[Zoom PoP Edge]
        LB[Load Balancer]
    end
    subgraph Core["Core Services"]
        SIG[Signaling Server]
        MMR[Multimedia Router]
        REC[Recording Service]
        PSTN[PSTN Gateway]
        BR[Breakout Room Manager]
    end
    subgraph Storage["Storage"]
        DB[(Meeting DB)]
        OBJ[(Cloud Recording Store)]
        CDN[CDN]
    end
    DESK & WEB & MOB & ROOM --> ZPE
    ZPE --> LB
    LB --> SIG & MMR
    MMR --> REC
    MMR --> PSTN
    SIG --> DB
    SIG --> BR
    REC --> OBJ
    OBJ --> CDN`,
  components: [
    { name: 'Multimedia Router (MMR)', description: 'Zoom\'s core media handling component — a custom SFU that receives, processes, and selectively forwards audio/video streams. MMRs are deployed in 18+ data centers and handle codec negotiation, simulcast layer selection, and bandwidth adaptation. Each meeting is assigned to an MMR based on participant geography.' },
    { name: 'Signaling Server', description: 'Manages meeting lifecycle — creation, join, leave, host controls, breakout rooms, and waiting rooms. Communicates with clients over HTTPS/WebSocket and coordinates participant state across MMRs.' },
    { name: 'Zoom PoP Edge', description: 'Points of Presence at 50+ locations worldwide that provide the nearest entry point for client connections. PoPs minimize the public internet hops for media traffic by routing it onto Zoom\'s private backbone as early as possible.' },
    { name: 'Recording Service', description: 'Captures meeting media server-side for cloud recordings or processes local recordings on the client. Cloud recordings are transcoded into multiple formats and stored with automatic transcription.' },
    { name: 'PSTN Gateway', description: 'Bridges traditional telephone calls into Zoom meetings. Handles SIP/H.323 interop for Zoom Rooms and dial-in participants. Integrates with Zoom Phone for PBX functionality.' },
    { name: 'Breakout Room Manager', description: 'Dynamically creates sub-meetings within a parent meeting. Each breakout room gets its own MMR session while maintaining the ability to broadcast messages from the host and recall participants to the main room.' },
  ],
  dataModel: `erDiagram
    MEETING {
        bigint meeting_id PK
        string host_id FK
        string topic
        enum type
        string password_hash
        int duration_minutes
        timestamp start_time
        json settings
    }
    PARTICIPANT {
        string session_id PK
        bigint meeting_id FK
        string user_id FK
        enum role
        string display_name
        timestamp join_time
        timestamp leave_time
    }
    RECORDING {
        string recording_id PK
        bigint meeting_id FK
        enum type
        string file_url
        int file_size
        int duration
        timestamp created_at
    }
    BREAKOUT_ROOM {
        string room_id PK
        bigint meeting_id FK
        string name
        int participant_limit
    }
    MEETING ||--o{ PARTICIPANT : has
    MEETING ||--o{ RECORDING : produces
    MEETING ||--o{ BREAKOUT_ROOM : contains`,
  deepDive: [
    {
      title: 'Multimedia Router (MMR) Architecture',
      content: `The **Multimedia Router** is Zoom's secret weapon — a highly optimized SFU written in C/C++ for maximum performance.\n\n**How it works**: Each meeting is assigned to an MMR. Participants send their encoded video to the MMR, which decides what to forward to each recipient based on:\n- **Active speaker detection**: The current speaker's video is prioritized\n- **Gallery view layout**: Up to 49 video tiles, each receiving an appropriate resolution\n- **Bandwidth estimation**: Each participant gets the highest quality their connection can handle\n\n**Multi-MMR meetings**: For geographically distributed meetings, Zoom cascades multiple MMRs. A meeting with participants in the US and Europe might use MMRs in both regions, with the MMRs exchanging media over Zoom's backbone. This keeps latency low for all participants.\n\n**Proprietary codecs**: While Zoom supports standard codecs (H.264, VP8), it also uses proprietary codecs optimized for screen sharing (high resolution, low frame rate, text-optimized) and low-bandwidth scenarios.`,
      diagram: `graph TB
    subgraph US_Participants["US Participants"]
        P1[User A]
        P2[User B]
    end
    subgraph EU_Participants["EU Participants"]
        P3[User C]
        P4[User D]
    end
    subgraph MMR_US["MMR - US East"]
        FWD1[Forwarder]
    end
    subgraph MMR_EU["MMR - EU West"]
        FWD2[Forwarder]
    end
    P1 & P2 <--> FWD1
    P3 & P4 <--> FWD2
    FWD1 <-->|Zoom Backbone| FWD2`,
    },
    {
      title: 'Hybrid Cloud and On-Premise Architecture',
      content: `Zoom offers a unique **hybrid cloud** deployment model that many competitors lack.\n\n**Meeting Connector**: Enterprises can deploy Zoom MMRs on-premise. Media stays within the corporate network while signaling still goes through Zoom's cloud. This satisfies data sovereignty requirements for government and financial customers.\n\n**Zone-based routing**: Zoom's infrastructure uses zones to control where media is processed. An admin can mandate that meetings for their organization only use MMRs in specific geographic zones (e.g., \"EU only\" or \"on-premise only\").\n\n**Failover**: If an on-premise MMR fails, the meeting automatically migrates to Zoom's cloud infrastructure. Participants experience a brief reconnection but no meeting termination.\n\n**Zoom Phone**: Extends the hybrid model to telephony. On-premise SBCs (Session Border Controllers) connect to the PSTN while call control runs in Zoom's cloud.`,
    },
    {
      title: 'Breakout Rooms at Scale',
      content: `Zoom's breakout rooms are architecturally interesting because they create **sub-meetings within a meeting**.\n\n**Implementation**: Each breakout room is a separate MMR session with its own media routing. The parent meeting's signaling server maintains the mapping of participants to rooms.\n\n**Host broadcast**: When the host broadcasts a message to all rooms, the signaling server sends it to each breakout room's session. For audio broadcasts, the host's audio stream is temporarily mixed into each room's MMR.\n\n**Participant movement**: Moving participants between rooms requires tearing down their media session in one room and establishing it in another. Zoom optimizes this by pre-allocating MMR capacity for the expected number of rooms.\n\n**Scale**: Zoom supports up to 50 breakout rooms per meeting, each with its own participant limit. The parent meeting can have 1,000 participants distributed across rooms, with the host maintaining visibility into all rooms simultaneously.`,
    },
  ],
  tradeoffs: [
    {
      decision: 'Native desktop client over browser-first',
      pros: ['Full control over codec and rendering pipeline', 'Better performance and lower latency', 'Access to OS-level features (virtual audio, screen capture)'],
      cons: ['Requires installation — friction for first-time users', 'Must maintain clients for every OS', 'Browser client is a second-class experience'],
    },
    {
      decision: 'Proprietary codecs alongside standards',
      pros: ['Optimized for specific use cases (screen sharing, low bandwidth)', 'Competitive advantage in quality', 'Can evolve independently of standards bodies'],
      cons: ['Not interoperable with standard WebRTC clients', 'Higher engineering cost to maintain', 'Lock-in risk for customers'],
    },
    {
      decision: 'Hybrid cloud / on-premise option',
      pros: ['Wins regulated enterprise customers', 'Data sovereignty compliance', 'Media stays on corporate network'],
      cons: ['Significant engineering complexity', 'On-prem hardware maintenance burden for customers', 'Feature parity lag between cloud and on-prem'],
    },
  ],
};
