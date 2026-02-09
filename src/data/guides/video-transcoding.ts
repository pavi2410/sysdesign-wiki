import type { FeatureGuide } from './types';

export const videoTranscoding: FeatureGuide = {
  slug: 'video-transcoding',
  title: 'Video Transcoding Pipeline',
  tagline: 'Adaptive bitrate encoding, queue-based processing, and HLS/DASH delivery for streaming',
  category: 'media',
  tags: ['video', 'transcoding', 'HLS', 'DASH', 'FFmpeg', 'streaming'],
  problem: `Users upload videos in countless formats (MP4, MOV, AVI, WebM) recorded on different devices with varying resolutions, codecs, and bitrates. To deliver a smooth playback experience across all devices and network conditions, videos must be transcoded into multiple formats and quality levels. Adaptive bitrate streaming (ABR) serves the right quality for each viewer's bandwidth in real time. The transcoding pipeline must handle large files (multi-GB), scale to thousands of concurrent jobs, manage compute costs (transcoding is CPU/GPU intensive), and deliver results within minutes — not hours.`,
  approaches: [
    {
      name: 'Queue-Based FFmpeg Workers',
      description: `Upload triggers a job in a message queue. Worker instances pull jobs, transcode using **FFmpeg** (the industry-standard tool), and upload results to storage. Workers scale horizontally based on queue depth. Simple, battle-tested, and highly customizable.`,
      pros: [
        'Full control over encoding parameters and pipeline',
        'FFmpeg supports virtually every codec and format',
        'Cost-efficient — use spot/preemptible instances for workers',
        'Can optimize for quality, speed, or file size per use case',
      ],
      cons: [
        'Must manage FFmpeg installation, updates, and licensing (codec patents)',
        'Scaling and infrastructure management is your responsibility',
        'Long-running jobs (hours for 4K video) need checkpoint/resume',
        'Monitoring transcoding quality requires expertise',
      ],
    },
    {
      name: 'Managed Transcoding Service',
      description: `Use a cloud transcoding service: **AWS MediaConvert**, **Google Transcoder API**, **Mux**, or **Cloudflare Stream**. Submit a job with input file and desired outputs. The service handles encoding, scaling, and delivery. Pay per minute of video processed.`,
      pros: [
        'Zero infrastructure to manage',
        'Auto-scales to any volume',
        'Optimized encoding pipelines (hardware acceleration, codec expertise)',
        'Built-in delivery (Mux, Cloudflare Stream include CDN)',
      ],
      cons: [
        'Per-minute pricing can be expensive at high volume',
        'Less control over encoding parameters',
        'Vendor lock-in for a critical pipeline',
        'May not support niche codecs or custom processing steps',
      ],
    },
    {
      name: 'Segmented Parallel Transcoding',
      description: `Split the input video into segments (10-30 seconds each), transcode segments in parallel across many workers, then concatenate the results. Dramatically reduces wall-clock time for long videos. Used by large-scale platforms for near-real-time processing.`,
      pros: [
        'Massively parallel — a 1-hour video processed in minutes',
        'Fault-tolerant — failed segments can be retried independently',
        'Scales linearly with worker count',
        'Ideal for time-sensitive content (live sports highlights, news)',
      ],
      cons: [
        'Complex orchestration — split, distribute, transcode, concatenate',
        'Segment boundaries can cause visual artifacts (must align to keyframes)',
        'Audio sync across segments requires careful handling',
        'Higher infrastructure cost (many short-lived workers)',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Upload
        CLIENT[Upload Client]
        S3_IN[(Input Storage<br/>S3)]
    end
    subgraph Orchestration["Job Orchestration"]
        API[Transcoding API]
        Q[Job Queue<br/>SQS / Kafka]
        ORCH[Job Orchestrator]
    end
    subgraph Workers["Transcoding Workers"]
        W1[FFmpeg Worker 1<br/>1080p H.264]
        W2[FFmpeg Worker 2<br/>720p H.264]
        W3[FFmpeg Worker 3<br/>480p H.264]
        W4[FFmpeg Worker 4<br/>1080p H.265]
    end
    subgraph Output["Output Processing"]
        PKG[HLS/DASH<br/>Packager]
        THUMB[Thumbnail<br/>Generator]
        S3_OUT[(Output Storage<br/>S3)]
    end
    subgraph Delivery
        CDN[CDN<br/>CloudFront]
    end
    CLIENT --> S3_IN
    S3_IN --> API
    API --> Q
    Q --> ORCH
    ORCH --> W1 & W2 & W3 & W4
    W1 & W2 & W3 & W4 --> PKG
    PKG --> S3_OUT
    ORCH --> THUMB
    THUMB --> S3_OUT
    S3_OUT --> CDN`,
  components: [
    { name: 'Transcoding API', description: 'Accepts transcoding requests with input file location and desired output profiles (resolutions, codecs, bitrates). Validates inputs, creates a transcoding job, and returns a job ID for status tracking. Supports presets for common output profiles (web, mobile, 4K).' },
    { name: 'Job Orchestrator', description: 'Breaks a transcoding job into sub-tasks: one per output profile (1080p H.264, 720p H.264, 480p, audio-only, thumbnails). Distributes sub-tasks to workers via the queue. Tracks completion of all sub-tasks and triggers packaging when all are done.' },
    { name: 'FFmpeg Workers', description: 'Stateless worker processes that pull transcoding tasks from the queue, download the input segment/file, run FFmpeg with the specified parameters, and upload the output. Auto-scaled based on queue depth. Use GPU instances (NVIDIA NVENC) for faster encoding when cost-effective.' },
    { name: 'HLS/DASH Packager', description: 'Takes the transcoded output files and packages them into adaptive bitrate streaming formats. Generates HLS manifests (.m3u8) and/or DASH manifests (.mpd) with multiple quality levels. Each quality level is segmented into 2-10 second chunks for adaptive switching.' },
    { name: 'Thumbnail Generator', description: 'Extracts frames from the video at specified intervals (every 10 seconds) for thumbnail sprites. Generates a poster image (best frame or specific timestamp). Creates animated preview GIFs for hover-to-preview UX. Uses FFmpeg\'s frame extraction capabilities.' },
    { name: 'Progress Tracker', description: 'Monitors transcoding progress by parsing FFmpeg output (frame count, encoding speed). Reports percentage completion per sub-task and overall job. Pushes updates via WebSocket/SSE to the client. Detects stalled jobs and triggers retries.' },
  ],
  dataModel: `erDiagram
    TRANSCODE_JOB {
        string job_id PK
        string input_key
        string user_id FK
        json output_profiles
        enum status
        int progress_percent
        timestamp created_at
        timestamp completed_at
    }
    TRANSCODE_TASK {
        string task_id PK
        string job_id FK
        string profile_name
        string codec
        int width
        int height
        int bitrate_kbps
        enum status
        string output_key
        int duration_ms
        timestamp started_at
        timestamp completed_at
    }
    VIDEO_ASSET {
        string asset_id PK
        string job_id FK
        string manifest_url
        json variants
        int duration_seconds
        json thumbnails
        json metadata
        timestamp created_at
    }
    TRANSCODE_JOB ||--o{ TRANSCODE_TASK : contains
    TRANSCODE_JOB ||--|| VIDEO_ASSET : produces`,
  deepDive: [
    {
      title: 'Adaptive Bitrate Streaming',
      content: `ABR serves multiple quality levels and lets the player switch dynamically based on network conditions.\n\n**HLS (HTTP Live Streaming)**: Apple's protocol, supported everywhere. Master playlist (.m3u8) references variant playlists for each quality level. Each variant is split into 2-10 second .ts segments. Player downloads segments sequentially, switching quality between segments based on bandwidth.\n\n**DASH (Dynamic Adaptive Streaming over HTTP)**: Open standard (ISO). Similar concept with an MPD manifest and segmented media files. Better codec flexibility (supports VP9, AV1 natively). Less universal than HLS on Apple devices.\n\n**Common output ladder** (quality levels):\n- 1080p @ 5000 kbps (high quality, good network)\n- 720p @ 2500 kbps (balanced)\n- 480p @ 1000 kbps (mobile / slow network)\n- 360p @ 600 kbps (very slow network)\n- Audio-only @ 128 kbps (extremely poor network)\n\n**Segment duration**: 2-6 seconds is typical. Shorter segments enable faster quality switching but increase manifest size and request count. 4 seconds is a common default.\n\n**Per-title encoding**: Netflix pioneered analyzing each video's complexity to choose optimal bitrates. A simple animation needs less bitrate than an action scene. Per-title encoding reduces storage and bandwidth by 20-40% without quality loss.`,
    },
    {
      title: 'Codec Selection and Tradeoffs',
      content: `**H.264 (AVC)**: The universal codec. Supported by every device and browser. Good quality-to-size ratio. Patent-licensed but widely available. Use as the baseline — always output H.264.\n\n**H.265 (HEVC)**: 30-50% better compression than H.264 at the same quality. Supported on modern devices (iOS, recent Android, Safari). Complex patent licensing. Use for 4K content where bandwidth savings are significant.\n\n**VP9**: Google's royalty-free codec. Similar compression to H.265. Supported in Chrome, Firefox, Android. Not supported in Safari/iOS. Use as an alternative to H.265 for web delivery.\n\n**AV1**: Next-generation royalty-free codec (Alliance for Open Media). 30% better than H.265 but very slow to encode (10-100x slower than H.264). Hardware decoding is becoming available. Use for pre-encoded content where encoding time is not a constraint.\n\n**Encoding speed vs quality**:\n- FFmpeg presets: ultrafast → superfast → veryfast → faster → fast → medium → slow → slower → veryslow\n- "medium" is the default — good balance of speed and quality\n- "fast" for time-sensitive content (live events, user uploads)\n- "slow" for premium content worth the extra encoding time\n\n**Two-pass encoding**: First pass analyzes the video, second pass encodes with optimal bit allocation. 50-100% slower but better quality for the same bitrate. Use for premium content.`,
    },
    {
      title: 'Cost Optimization',
      content: `Video transcoding is one of the most compute-intensive workloads. Cost optimization is critical.\n\n**Spot/preemptible instances**: Transcoding is fault-tolerant (can restart from checkpoints). Use AWS Spot Instances (60-90% cheaper) or GCP Preemptible VMs. Implement checkpoint/resume for long-running jobs in case of instance termination.\n\n**GPU vs CPU encoding**: NVIDIA NVENC hardware encoding is 5-10x faster than CPU encoding. GPU instances are more expensive per hour but cheaper per video due to speed. Break-even depends on your volume — typically GPU wins above 100 videos/day.\n\n**Encode only what's needed**: Don't transcode to 1080p if the source is 720p. Analyze input resolution and only generate output profiles at or below the source quality. Skip audio transcoding if the input codec is already AAC.\n\n**Just-in-time transcoding**: For low-traffic content, don't pre-transcode all quality levels. Transcode the most common profiles (720p, 480p) immediately, and transcode higher profiles on first request. Cache the result for subsequent viewers.\n\n**Storage optimization**: Delete intermediate files after packaging. Keep only the final HLS/DASH segments. For rarely accessed content, use S3 Intelligent-Tiering to automatically move to cheaper storage classes.\n\n**Encoding efficiency metrics**: Track cost per minute of output video, encoding speed ratio (real-time = 1x, 2x = twice real-time speed), and quality metrics (VMAF score) to optimize the cost/quality tradeoff.`,
    },
  ],
  realWorldExamples: [
    { system: 'YouTube', approach: 'Processes 500+ hours of video per minute. Custom encoding pipeline that generates dozens of output profiles per video. Uses VP9 and AV1 for bandwidth savings. Per-title encoding optimizes bitrate per video. Encodes in parallel across thousands of machines.' },
    { system: 'Netflix', approach: 'Pioneered per-title encoding — analyzing each title\'s complexity to determine optimal encoding ladders. Uses AV1 for most content. Encodes at "slow" preset for maximum quality. Shot-based encoding splits videos at scene boundaries for parallel processing.' },
    { system: 'Mux', approach: 'Video API platform handling upload, transcoding, and delivery. Automatic bitrate ladder selection. Just-in-time transcoding for on-demand content. Integrated CDN delivery. Real-time analytics on playback quality (rebuffering rate, startup time).' },
    { system: 'Cloudflare Stream', approach: 'Upload video via API or dashboard. Automatic transcoding to HLS with multiple quality levels. Global CDN delivery included. Per-minute-stored and per-minute-delivered pricing. Supports direct creator uploads, live streaming, and signed URLs for access control.' },
  ],
  tradeoffs: [
    {
      decision: 'Self-hosted FFmpeg vs managed transcoding service',
      pros: ['Self-hosted: full control, lower per-video cost at scale', 'Managed: zero ops, automatic scaling, optimized pipelines', 'Self-hosted: supports any codec, custom processing steps'],
      cons: ['Self-hosted: significant infrastructure and FFmpeg expertise needed', 'Managed: per-minute pricing adds up, less customization', 'Self-hosted: must handle GPU provisioning, queue management, monitoring'],
    },
    {
      decision: 'H.264 everywhere vs multi-codec strategy',
      pros: ['H.264-only: universal compatibility, simple pipeline', 'Multi-codec: 30-50% bandwidth savings with H.265/AV1', 'Multi-codec: better quality for users with modern devices'],
      cons: ['H.264-only: higher bandwidth costs, lower quality per bitrate', 'Multi-codec: more storage (multiple versions), complex manifest logic', 'Multi-codec: AV1 encoding is extremely slow and expensive'],
    },
    {
      decision: 'Pre-transcode all profiles vs just-in-time encoding',
      pros: ['Pre-transcode: instant playback, no first-viewer penalty', 'JIT: massive storage savings for rarely watched content', 'JIT: only encode what viewers actually request'],
      cons: ['Pre-transcode: storage costs for content that may never be watched', 'JIT: first viewer waits for transcoding (seconds to minutes)', 'JIT: more complex serving logic and cache management'],
    },
  ],
};
