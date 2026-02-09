import type { FeatureGuide } from './types';

export const fileUploadPipeline: FeatureGuide = {
  slug: 'file-upload-pipeline',
  title: 'File Upload Pipeline',
  tagline: 'Chunked and resumable uploads, server-side processing, and CDN delivery at scale',
  category: 'media',
  tags: ['upload', 'files', 'chunked', 'resumable', 'S3', 'CDN'],
  problem: `File uploads seem simple until you handle large files (multi-GB videos), unreliable networks (mobile users losing connection mid-upload), concurrent uploads from thousands of users, and post-upload processing (virus scanning, thumbnail generation, format conversion). A production upload pipeline needs resumable uploads (don't restart a 2GB upload from scratch), direct-to-storage uploads (bypass your API server), progress tracking, file validation, and an async processing pipeline that transforms uploads into the formats your application needs.`,
  approaches: [
    {
      name: 'Presigned URL Direct Upload',
      description: `Generate a presigned URL from your API server that allows the client to upload directly to cloud storage (S3, GCS, R2). Your server never handles the file bytes — it only generates the upload URL and is notified via event/webhook when the upload completes. Best for most use cases.`,
      pros: [
        'API server handles zero file bytes — massively reduces bandwidth and CPU',
        'Scales naturally — cloud storage handles concurrent uploads',
        'Client can upload directly from browser/mobile with progress tracking',
        'Built-in multipart upload support in S3/GCS for large files',
      ],
      cons: [
        'Two-step process: get presigned URL, then upload',
        'Harder to validate file content before it reaches storage',
        'CORS configuration required for browser uploads',
        'Presigned URLs have expiry — must handle edge cases',
      ],
    },
    {
      name: 'Chunked Upload via API Server',
      description: `Client splits the file into chunks (1-10MB each) and uploads each chunk to your API server, which reassembles them. Supports resume by tracking which chunks have been received. Used when you need server-side validation or transformation before storage.`,
      pros: [
        'Full control over each chunk — validate, transform, scan in real-time',
        'Resumable by nature — only re-upload failed chunks',
        'Works behind restrictive firewalls that block direct cloud storage access',
        'Can implement deduplication (hash each chunk, skip known chunks)',
      ],
      cons: [
        'API server handles all file bytes — bandwidth and CPU intensive',
        'More complex client-side implementation (chunking, tracking, reassembly)',
        'Must manage temporary chunk storage and cleanup',
        'Harder to scale than direct-to-storage uploads',
      ],
    },
    {
      name: 'tus Protocol (Resumable Upload Standard)',
      description: `**tus** is an open protocol for resumable file uploads over HTTP. Clients and servers implement the tus specification, which defines how to create uploads, send chunks, and resume interrupted transfers. Libraries available for every major platform.`,
      pros: [
        'Standardized protocol — interoperable clients and servers',
        'Built-in resumability with offset tracking',
        'Rich ecosystem of client (Uppy) and server (tusd) libraries',
        'Protocol handles all edge cases (network failures, concurrent chunks)',
      ],
      cons: [
        'Additional protocol to implement and maintain',
        'May be overkill for simple upload scenarios',
        'Server must handle tus-specific endpoints and headers',
        'Less control than a fully custom implementation',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Client
        APP[Web/Mobile App]
        UPPY[Upload Client<br/>Uppy / Custom]
    end
    subgraph API["API Layer"]
        UPLOAD_API[Upload API<br/>Presigned URLs]
        WEBHOOK[Upload Complete<br/>Webhook]
    end
    subgraph Storage["Storage Layer"]
        S3[(Object Storage<br/>S3 / R2 / GCS)]
        TMP[(Temp Storage<br/>Processing)]
    end
    subgraph Processing["Processing Pipeline"]
        Q[Job Queue]
        SCAN[Virus Scanner]
        THUMB[Thumbnail<br/>Generator]
        TRANSCODE[Format<br/>Converter]
        META[Metadata<br/>Extractor]
    end
    subgraph Delivery["Delivery"]
        CDN[CDN<br/>CloudFront / CF]
    end
    subgraph DB["Database"]
        FILES[(File Registry)]
    end
    APP --> UPPY
    UPPY --> UPLOAD_API
    UPLOAD_API -->|Presigned URL| UPPY
    UPPY -->|Direct upload| S3
    S3 -->|Event notification| WEBHOOK
    WEBHOOK --> Q
    Q --> SCAN & THUMB & TRANSCODE & META
    SCAN & THUMB & TRANSCODE & META --> TMP
    TMP --> S3
    WEBHOOK --> FILES
    S3 --> CDN`,
  components: [
    { name: 'Upload API', description: 'Generates presigned upload URLs, validates upload metadata (file type, size limits), and tracks upload state. Returns a presigned URL with a 15-60 minute expiry. For multipart uploads, orchestrates the initiation, part URLs, and completion API calls.' },
    { name: 'Upload Client (Uppy)', description: 'Client-side library handling file selection, chunking, progress tracking, and retry logic. Uppy is the most popular open-source option with tus, S3, and XHR upload plugins. Provides drag-and-drop UI, progress bars, and thumbnail previews.' },
    { name: 'Processing Pipeline', description: 'Async job queue triggered by upload completion events. Runs processing steps: virus scanning (ClamAV), thumbnail generation (sharp/ImageMagick), video transcoding (FFmpeg), metadata extraction (EXIF, duration, dimensions), and format conversion. Each step is an independent job for parallel processing.' },
    { name: 'File Registry', description: 'Database tracking all uploaded files: original filename, storage key, content type, size, processing status, generated variants (thumbnails, transcoded versions), and access permissions. The canonical record of what exists in storage.' },
    { name: 'Virus Scanner', description: 'Scans uploaded files for malware before they are served to other users. Uses ClamAV or a cloud scanning service. Quarantines infected files and notifies the uploader. Must scan before the file is accessible via CDN.' },
    { name: 'CDN Delivery Layer', description: 'Serves processed files via a CDN for low-latency global delivery. Signed URLs for access-controlled files. Image optimization (WebP conversion, responsive resizing) at the edge. Cache headers optimized per file type.' },
  ],
  dataModel: `erDiagram
    UPLOAD {
        string upload_id PK
        string user_id FK
        string filename
        string content_type
        int size_bytes
        string storage_key
        enum status
        string upload_url
        timestamp created_at
        timestamp completed_at
    }
    FILE_VARIANT {
        string variant_id PK
        string upload_id FK
        string variant_type
        string storage_key
        string content_type
        int size_bytes
        json metadata
        timestamp created_at
    }
    PROCESSING_JOB {
        string job_id PK
        string upload_id FK
        string job_type
        enum status
        json result
        string error_message
        timestamp started_at
        timestamp completed_at
    }
    UPLOAD ||--o{ FILE_VARIANT : generates
    UPLOAD ||--o{ PROCESSING_JOB : triggers`,
  deepDive: [
    {
      title: 'S3 Multipart Upload Flow',
      content: `For files larger than 100MB, S3 multipart upload splits the file into parts uploaded in parallel.\n\n**Flow**:\n1. **Initiate**: API calls \`CreateMultipartUpload\` → returns an upload ID\n2. **Upload Parts**: Client uploads each part (5MB-5GB each) with the upload ID and part number. Each part returns an ETag.\n3. **Complete**: API calls \`CompleteMultipartUpload\` with the list of part numbers and ETags. S3 assembles the final object.\n4. **Abort**: If upload fails, call \`AbortMultipartUpload\` to clean up parts.\n\n**Presigned approach**: Generate a presigned URL for each part. Client uploads parts directly to S3. Your server only orchestrates the initiate/complete calls.\n\n**Resume**: If a part upload fails, only that part needs to be re-uploaded. List uploaded parts with \`ListParts\` and resume from the last successful part.\n\n**Parallel uploads**: Upload multiple parts simultaneously (3-5 concurrent parts is typical). Total upload time = file_size / (part_count × bandwidth_per_connection). A 1GB file with 5 parallel 100MB parts completes 5x faster than sequential upload.\n\n**Cleanup**: Set an S3 lifecycle rule to abort incomplete multipart uploads after 7 days. Otherwise, orphaned parts accumulate and incur storage costs.`,
    },
    {
      title: 'File Validation and Security',
      content: `Uploaded files are untrusted user input — treat them with extreme caution.\n\n**Content type validation**: Don't trust the client's Content-Type header. Validate by reading the file's magic bytes (file signature). A .jpg file should start with \`FF D8 FF\`. Libraries: \`file-type\` (Node.js), \`python-magic\`.\n\n**Size limits**: Enforce per-file and per-user limits. Check BEFORE the upload completes — presigned URLs can include a content-length-range condition. S3 presigned POSTs support conditions like \`["content-length-range", 0, 10485760]\` (10MB max).\n\n**Filename sanitization**: Never use the original filename for storage. Generate a random key (UUID or hash). Store the original filename in the database for display only. This prevents path traversal attacks and filename collisions.\n\n**Image-specific**: Reprocess all uploaded images (strip EXIF metadata for privacy, re-encode to prevent polyglot files). Use a library like sharp to decode and re-encode. This neutralizes steganography and embedded exploits.\n\n**Virus scanning**: Scan every file before it's accessible. Use ClamAV (open source) or a cloud API (VirusTotal, AWS GuardDuty). Quarantine suspicious files and notify the uploader. Never serve a file that hasn't been scanned.\n\n**Storage isolation**: Store uploads in a separate bucket/container from your application code. Never store uploads in a web-accessible directory. Serve only through your CDN or via presigned download URLs.`,
    },
    {
      title: 'Progress Tracking and UX',
      content: `File uploads are one of the few user-facing operations that can take minutes. Good UX is critical.\n\n**Client-side progress**: XMLHttpRequest and fetch both support upload progress events. Show a progress bar with percentage, upload speed, and estimated time remaining. For chunked uploads, track per-chunk and overall progress.\n\n**Server-side status**: Store upload status in the database: pending → uploading → processing → complete. Clients can poll a status endpoint or subscribe via SSE for real-time updates. Show processing status after upload completes (e.g., "Generating thumbnails...").\n\n**Retry UX**: On failure, show "Upload failed. Retry?" button — don't silently restart. For resumable uploads, show "Resuming from 67%..." to reassure the user that progress wasn't lost.\n\n**Drag and drop**: Support drag-and-drop file selection alongside the traditional file picker. Show a drop zone overlay when files are dragged over the page. Uppy provides this out of the box.\n\n**Batch uploads**: For multiple files, show individual progress per file with an overall progress summary. Allow canceling individual files without affecting others. Process files in parallel (2-3 concurrent uploads) for faster batch completion.\n\n**Mobile considerations**: Mobile networks are unreliable. Use smaller chunk sizes (1-2MB vs 5-10MB on desktop). Implement aggressive retry logic. Consider pausing uploads when the app is backgrounded and resuming when it returns to the foreground.`,
    },
  ],
  realWorldExamples: [
    { system: 'Dropbox', approach: 'Chunked upload API with 150MB max chunk size. Block-level deduplication — only new/changed blocks are uploaded. Delta sync reduces upload size for file modifications. Client compresses chunks before upload for bandwidth savings.' },
    { system: 'YouTube', approach: 'Resumable upload protocol for video files up to 256GB. Uploads go to Google Cloud Storage. Triggers a massive transcoding pipeline (dozens of output formats/resolutions). Processing can take minutes to hours depending on video length.' },
    { system: 'Cloudflare R2', approach: 'S3-compatible object storage with zero egress fees. Supports multipart uploads up to 5TB per object. Integrated with Cloudflare CDN for instant global delivery. Workers can intercept uploads for custom processing.' },
    { system: 'Transloadit', approach: 'File upload and processing service. Handles upload (tus protocol), transformation (resize, transcode, watermark), and delivery. Assembly concept: define a processing pipeline as a JSON template. Used by companies that don\'t want to build processing infrastructure.' },
  ],
  tradeoffs: [
    {
      decision: 'Presigned URL (direct-to-storage) vs upload through API server',
      pros: ['Presigned: zero bandwidth on API server, scales effortlessly', 'Through API: full control, can validate/process in real-time', 'Presigned: client gets direct S3 upload speed (no middleman)'],
      cons: ['Presigned: can\'t validate file content before it reaches storage', 'Through API: API server is a bottleneck, expensive bandwidth', 'Presigned: more complex client-side flow (two-step)'],
    },
    {
      decision: 'Process synchronously vs async pipeline',
      pros: ['Sync: immediate availability of processed files', 'Async: upload completes instantly, processing happens in background', 'Async: can retry failed processing without re-uploading'],
      cons: ['Sync: slow uploads (waiting for processing), blocks the request', 'Async: files not immediately available after upload', 'Async: must track processing status and handle failures'],
    },
    {
      decision: 'tus protocol vs custom chunked upload',
      pros: ['tus: standardized, rich ecosystem (Uppy + tusd)', 'Custom: full control, tailored to your exact needs', 'tus: resumability and error handling solved for you'],
      cons: ['tus: additional protocol complexity, another server to run', 'Custom: must implement chunking, resume, and error handling', 'tus: may be overkill for simple upload scenarios'],
    },
  ],
};
