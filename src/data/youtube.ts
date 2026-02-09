import type { SystemDesign } from './types';

export const youtube: SystemDesign = {
  slug: 'youtube',
  name: 'YouTube',
  tagline: 'The world\'s largest video platform serving billions of hours daily',
  category: 'streaming',
  tags: ['streaming', 'video', 'CDN', 'recommendation', 'transcoding', 'ads'],
  overview: `YouTube is the world's largest video sharing platform, with 2.7B+ monthly active users watching over 1 billion hours of video every day. Its architecture must handle massive-scale video ingestion (500+ hours uploaded per minute), transcoding into dozens of formats and resolutions, a globally distributed CDN for low-latency playback, a recommendation engine that drives 70% of watch time, and a real-time ad serving system. YouTube's infrastructure runs on Google's global network and leverages custom hardware for video transcoding at scale.`,
  scale: {
    'Monthly active users': '2.7B+',
    'Hours of video watched/day': '1B+',
    'Video uploads per minute': '500+ hours',
    'Content library': '800M+ videos',
  },
  requirements: {
    functional: [
      'Video upload, transcoding, and playback',
      'Adaptive bitrate streaming (DASH/HLS)',
      'Personalized recommendation feed',
      'Live streaming with real-time chat',
      'Comments, likes, subscriptions, and notifications',
      'Monetization: ads, memberships, Super Chat',
      'Content moderation and copyright detection (Content ID)',
    ],
    nonFunctional: [
      'Playback start time <2 seconds globally',
      'Zero buffering for 95%+ of playback sessions',
      'Transcoding throughput for 500+ hours/minute of uploads',
      'Recommendation latency <200ms per request',
      'Ad serving latency <100ms',
      'Global CDN with 99.99% availability',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        WEB[Web Player]
        MOB[Mobile App]
        TV[Smart TV / Cast]
        CREATOR[Creator Studio]
    end
    subgraph Edge["Edge / CDN"]
        GCDN[Google CDN Edge PoPs]
        LB[Load Balancer]
    end
    subgraph Services["Core Services"]
        UPLOAD[Upload Service]
        TRANSCODE[Transcoding Pipeline]
        PLAY[Playback Service]
        REC[Recommendation Engine]
        ADS[Ad Serving]
        SEARCH[Search Service]
        LIVE[Live Service]
        MODERATE[Content Moderation]
    end
    subgraph Storage["Storage"]
        BLOB[(Video Blob Store)]
        META[(Video Metadata DB)]
        GRAPH[(Social Graph)]
        ADDB[(Ad Inventory)]
        MLMODEL[(ML Models)]
    end
    WEB & MOB & TV --> GCDN
    CREATOR --> LB
    GCDN --> PLAY
    LB --> UPLOAD & SEARCH & REC
    UPLOAD --> TRANSCODE
    TRANSCODE --> BLOB
    PLAY --> BLOB & META
    REC --> META & GRAPH & MLMODEL
    ADS --> ADDB
    MODERATE --> MLMODEL
    LIVE --> GCDN`,
  components: [
    { name: 'Upload & Ingestion Service', description: 'Handles video uploads with resumable upload support. Validates file formats, extracts metadata, generates initial thumbnails, and queues the video for transcoding. Supports uploads up to 256GB per video.' },
    { name: 'Transcoding Pipeline', description: 'Converts uploaded videos into 10+ resolution/codec combinations (144p to 4K/8K, H.264/VP9/AV1). Uses a distributed job system running on custom video transcoding hardware (VCUs). Applies perceptual quality optimization to minimize bitrate while maintaining visual quality.' },
    { name: 'Playback Service', description: 'Serves video segments via adaptive bitrate streaming (DASH). Selects the optimal CDN PoP and format based on client capabilities, network conditions, and geographic location. Handles DRM for premium content.' },
    { name: 'Recommendation Engine', description: 'Drives 70%+ of watch time. Uses a deep learning model (two-tower architecture: candidate generation + ranking) trained on user watch history, engagement signals, and content features. Serves personalized recommendations in <200ms.' },
    { name: 'Ad Serving', description: 'Real-time auction system that selects and inserts ads into video playback. Considers advertiser targeting, user demographics, content suitability, and bid price. Supports pre-roll, mid-roll, and overlay ad formats.' },
    { name: 'Content Moderation & Content ID', description: 'ML-based system that scans uploads for policy violations (violence, spam, misinformation) and copyright infringement. Content ID fingerprints audio/video against a database of 100M+ reference files from rights holders.' },
    { name: 'Live Streaming Service', description: 'Ingests RTMP streams from creators, transcodes in real-time at multiple qualities, and distributes via CDN with 2-15 second latency. Handles real-time chat, Super Chat payments, and live DVR (rewind).' },
  ],
  dataModel: `erDiagram
    VIDEO {
        string video_id PK
        string channel_id FK
        string title
        string description
        enum status
        int duration_seconds
        bigint view_count
        bigint like_count
        timestamp published_at
    }
    CHANNEL {
        string channel_id PK
        string user_id FK
        string name
        bigint subscriber_count
        timestamp created_at
    }
    VIDEO_FORMAT {
        string format_id PK
        string video_id FK
        enum codec
        int width
        int height
        int bitrate_kbps
        string blob_path
    }
    WATCH_EVENT {
        string event_id PK
        string user_id FK
        string video_id FK
        int watch_duration_sec
        float completion_rate
        timestamp watched_at
    }
    COMMENT {
        string comment_id PK
        string video_id FK
        string author_id FK
        string text
        bigint like_count
        timestamp created_at
    }
    CHANNEL ||--o{ VIDEO : uploads
    VIDEO ||--o{ VIDEO_FORMAT : has
    VIDEO ||--o{ WATCH_EVENT : generates
    VIDEO ||--o{ COMMENT : has`,
  deepDive: [
    {
      title: 'Video Transcoding at Scale',
      content: `YouTube transcodes 500+ hours of video every minute into dozens of format combinations. This is one of the largest transcoding workloads on Earth.\n\n**Format matrix**: Each video is encoded into multiple resolutions (144p, 240p, 360p, 480p, 720p, 1080p, 1440p, 4K, 8K) × multiple codecs (H.264 for compatibility, VP9 for quality/size, AV1 for next-gen efficiency). That's 20-30+ variants per video.\n\n**Custom hardware**: YouTube uses custom **Video Coding Units (VCUs)** — ASICs designed specifically for video transcoding. These are 20-30x more power-efficient than general-purpose CPUs for this workload.\n\n**Perceptual quality optimization**: YouTube doesn't use fixed bitrate targets. Instead, it uses a perceptual quality metric (SSIM/VMAF) to find the minimum bitrate that achieves a target quality level. Simple scenes (talking head) get lower bitrate; complex scenes (action, sports) get higher bitrate. This saves 20-50% bandwidth with no visible quality loss.\n\n**Prioritized encoding**: Popular videos are re-encoded with more compute-intensive settings (slower presets, more passes) because the bandwidth savings multiply across millions of views. Rarely watched videos use faster, less optimal encoding.`,
      diagram: `graph LR
    UPLOAD[Raw Upload] --> SPLIT[Chunk Splitter]
    SPLIT --> E1[Encode 1080p H.264]
    SPLIT --> E2[Encode 1080p VP9]
    SPLIT --> E3[Encode 720p H.264]
    SPLIT --> E4[Encode 720p VP9]
    SPLIT --> E5[Encode 4K AV1]
    SPLIT --> EN[... 20+ formats]
    E1 & E2 & E3 & E4 & E5 & EN --> STORE[Blob Store]
    STORE --> CDN[CDN Distribution]`,
    },
    {
      title: 'Recommendation System Architecture',
      content: `YouTube's recommendation engine drives over 70% of total watch time. It's a massive-scale ML system serving billions of recommendations per day.\n\n**Two-stage architecture**:\n1. **Candidate generation**: From a corpus of 800M+ videos, a lightweight model narrows down to ~1,000 candidates relevant to the user. Uses a deep neural network that embeds user history and video features into the same vector space, then performs approximate nearest-neighbor search.\n2. **Ranking**: A more powerful model scores each candidate on predicted watch time, engagement probability, and satisfaction metrics. This model considers hundreds of features: video freshness, channel relationship, time of day, device type, etc.\n\n**Training**: Models are trained on petabytes of user interaction data. The primary objective is **expected watch time** (not click-through rate) to avoid clickbait optimization. Additional objectives include user satisfaction signals (likes, surveys) and diversity.\n\n**Serving**: The recommendation pipeline runs in <200ms. Candidate generation uses an ANN (Approximate Nearest Neighbor) index served from memory. Ranking runs on TPUs for inference.\n\n**Exploration**: A fraction of recommendations are intentionally exploratory — surfacing content from new creators or outside the user's typical interests — to prevent filter bubbles and help new creators get discovered.`,
    },
    {
      title: 'Content ID and Copyright Detection',
      content: `YouTube's **Content ID** system is one of the largest audio/video fingerprinting systems in the world, protecting the intellectual property of rights holders.\n\n**Reference database**: Rights holders upload reference files (songs, movies, TV shows) to Content ID. The system generates a compact digital fingerprint of each reference — a representation of the audio and video characteristics.\n\n**Fingerprint matching**: Every uploaded video is fingerprinted and compared against the 100M+ reference files. The matching algorithm is robust to modifications — it can detect copyrighted content even when the audio pitch is shifted, the video is cropped, or the content is overlaid with other elements.\n\n**Policy enforcement**: When a match is found, the rights holder's policy is applied automatically:\n- **Block**: Video is taken down\n- **Monetize**: Ads are placed on the video and revenue goes to the rights holder\n- **Track**: The match is recorded but no action is taken\n\n**Scale**: Content ID scans 500+ hours of video per minute against 100M+ reference files. The fingerprint comparison uses locality-sensitive hashing (LSH) for sub-linear search time.\n\n**Appeals**: Creators can dispute Content ID claims, triggering a manual review process. The system handles millions of claims and disputes per month.`,
    },
  ],
  tradeoffs: [
    {
      decision: 'Multiple codec support (H.264 + VP9 + AV1)',
      pros: ['Broad device compatibility', 'Progressive quality improvement as clients adopt newer codecs', 'AV1 provides 30-50% bitrate savings over VP9'],
      cons: ['Transcoding cost multiplied per codec', 'Massive storage for all format variants', 'Complex playback client logic for format selection'],
    },
    {
      decision: 'Watch time optimization over click-through rate',
      pros: ['Reduces clickbait and low-quality content', 'Better aligns with user satisfaction', 'Longer sessions increase ad revenue naturally'],
      cons: ['Can create "rabbit hole" effect with increasingly engaging content', 'Harder to optimize than simple CTR', 'New creators with short content may be disadvantaged'],
    },
    {
      decision: 'Custom transcoding hardware (VCUs) over general-purpose compute',
      pros: ['20-30x better power efficiency', 'Purpose-built for YouTube\'s workload', 'Lower operational cost at scale'],
      cons: ['High upfront hardware development cost', 'Less flexible than CPUs/GPUs', 'Multi-year commitment to a hardware design'],
    },
  ],
};
