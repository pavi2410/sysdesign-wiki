import type { SystemDesign } from './types';

export const googleDrive: SystemDesign = {
  slug: 'google-drive',
  name: 'Google Drive',
  tagline: 'Cloud file storage and real-time collaboration at planetary scale',
  category: 'productivity',
  tags: ['storage', 'collaboration', 'sync', 'sharing', 'cloud', 'google'],
  overview: `Google Drive is a cloud storage and file synchronization service used by 1B+ users and deeply integrated with Google Workspace (Docs, Sheets, Slides). Its architecture handles petabytes of user files, real-time multi-user collaboration on documents, granular sharing permissions, cross-device sync, and full-text search across stored files. Drive must provide strong consistency for collaborative editing while maintaining high availability and low-latency file access globally. It leverages Google's Colossus distributed filesystem and Spanner database for its storage backbone.`,
  scale: {
    'Users': '1B+',
    'Files stored': 'Trillions',
    'Storage capacity': 'Exabytes',
    'Daily active collaborators': '100M+',
  },
  requirements: {
    functional: [
      'File upload, download, and preview for 100+ file types',
      'Real-time collaborative editing (Docs, Sheets, Slides)',
      'Folder hierarchy and organizational shortcuts',
      'Granular sharing permissions (viewer, commenter, editor)',
      'Cross-device sync (desktop, mobile, web)',
      'Full-text search across files including scanned documents (OCR)',
      'Version history and trash recovery',
    ],
    nonFunctional: [
      'Strong consistency for collaborative edits',
      'High availability (99.99%+ uptime)',
      'Low-latency file access via global CDN',
      'Durability — no data loss (11 nines)',
      'Efficient sync — delta updates for large files',
      'Compliance: DLP, retention policies, audit logs',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        WEB[Web App]
        DESK[Desktop Sync Client]
        MOB[Mobile App]
        API_C[Drive API]
    end
    subgraph Edge["Edge Layer"]
        CDN[Google CDN]
        LB[Load Balancer]
    end
    subgraph Services["Core Services"]
        META[Metadata Service]
        UPLOAD[Upload Service]
        SYNC[Sync Service]
        COLLAB[Collaboration Engine]
        SEARCH[Search Service]
        SHARE[Sharing Service]
        PREVIEW[Preview Generator]
    end
    subgraph Storage["Storage Layer"]
        SPANNER[(Spanner - Metadata)]
        COLOSSUS[(Colossus - File Blobs)]
        INDEX[(Search Index)]
        CACHE[(Memcache)]
    end
    WEB & DESK & MOB & API_C --> CDN & LB
    LB --> META & UPLOAD & SYNC & COLLAB & SEARCH & SHARE
    CDN --> COLOSSUS
    UPLOAD --> COLOSSUS
    META --> SPANNER & CACHE
    SYNC --> SPANNER
    COLLAB --> SPANNER
    SEARCH --> INDEX
    PREVIEW --> COLOSSUS`,
  components: [
    { name: 'Metadata Service', description: 'Manages file and folder metadata — names, hierarchy, permissions, version history, and timestamps. Backed by Spanner for globally consistent reads and writes. Every file operation (create, move, rename, share) is a metadata transaction.' },
    { name: 'Upload Service', description: 'Handles file uploads with resumable upload support for large files. Files are chunked, deduplicated (content-addressed), and written to Colossus. Supports delta uploads — only changed blocks of a file are transmitted.' },
    { name: 'Sync Service', description: 'Keeps desktop and mobile clients in sync with the cloud state. Uses a change-feed model — clients poll for changes since their last sync token. Conflict resolution uses last-writer-wins for file replacements and OT/CRDT for collaborative docs.' },
    { name: 'Collaboration Engine', description: 'Powers real-time multi-user editing in Docs, Sheets, and Slides. Uses Operational Transformation (OT) to merge concurrent edits from multiple users. Each keystroke is an operation that is transformed against concurrent operations to maintain consistency.' },
    { name: 'Search Service', description: 'Indexes file names, content (extracted text), and metadata. Supports queries like "from:alice type:pdf budget". Uses OCR to index text in scanned documents and images. Search respects sharing permissions — users only see files they have access to.' },
    { name: 'Sharing Service', description: 'Manages the access control list (ACL) for every file and folder. Supports individual sharing, group sharing, link sharing (anyone with link), and organizational policies. Permissions inherit down folder hierarchies with override capability.' },
    { name: 'Preview Generator', description: 'Generates previews and thumbnails for 100+ file types (PDF, Office docs, images, videos). Runs asynchronously after upload. Previews are cached at the CDN for fast subsequent access.' },
  ],
  dataModel: `erDiagram
    FILE {
        string file_id PK
        string name
        string mime_type
        bigint size_bytes
        string parent_id FK
        string owner_id FK
        int version
        string content_hash
        boolean trashed
        timestamp modified_at
    }
    USER {
        string user_id PK
        string email
        bigint quota_bytes
        bigint used_bytes
    }
    PERMISSION {
        string permission_id PK
        string file_id FK
        string grantee_id
        enum grantee_type
        enum role
        timestamp created_at
    }
    REVISION {
        string revision_id PK
        string file_id FK
        string modifier_id FK
        bigint size_bytes
        timestamp created_at
    }
    USER ||--o{ FILE : owns
    FILE ||--o{ PERMISSION : has
    FILE ||--o{ REVISION : has_versions`,
  deepDive: [
    {
      title: 'Operational Transformation for Real-time Collaboration',
      content: `Google Docs' real-time collaboration is powered by **Operational Transformation (OT)**, a consistency algorithm that allows multiple users to edit the same document simultaneously.\n\n**How OT works**: Each user's edit is represented as an operation (insert character at position X, delete range Y-Z). When two users edit concurrently, their operations may conflict. OT transforms one operation against the other so that both can be applied in any order and reach the same final state.\n\n**Server as authority**: Google's OT implementation uses a central server as the source of truth. Each client sends operations to the server, which transforms them against any concurrent operations it has already accepted, then broadcasts the transformed operation to all other clients.\n\n**Revision history**: Every accepted operation increments the document's revision number. The server stores the full operation log, which enables undo, version history, and "see changes" features.\n\n**Cursor and selection**: User cursors and selections are also synced via OT. When a remote user inserts text before your cursor, your cursor position is automatically adjusted by transforming it against the insert operation.`,
      diagram: `sequenceDiagram
    participant A as User A
    participant S as Server
    participant B as User B
    A->>S: Insert "X" at pos 3 (rev 5)
    B->>S: Delete pos 2 (rev 5)
    S->>S: Transform: A's insert shifts to pos 2 after B's delete
    S->>A: Transformed delete at pos 2
    S->>B: Transformed insert at pos 2
    Note over A,B: Both reach same document state`,
    },
    {
      title: 'Colossus and Content-Addressed Storage',
      content: `File blobs in Google Drive are stored on **Colossus**, Google's next-generation distributed filesystem (successor to GFS).\n\n**Content-addressed storage**: Files are chunked into fixed-size blocks, and each block is identified by its content hash (SHA-256). Identical blocks across different files are stored only once (deduplication). This is especially effective for versioned files where only a few blocks change between versions.\n\n**Erasure coding**: Rather than storing three full replicas of each block (3x storage overhead), Colossus uses Reed-Solomon erasure coding. A block is encoded into N data chunks + M parity chunks, and any N of the N+M chunks can reconstruct the original. This achieves the same durability as 3x replication at ~1.5x storage overhead.\n\n**Tiered storage**: Frequently accessed files are kept on SSDs, while older files migrate to spinning disks and eventually to cold storage tape. The metadata service tracks the storage tier and handles transparent retrieval.\n\n**Global replication**: For Drive, files are replicated across multiple data center regions for disaster recovery. The metadata in Spanner records which regions hold copies of each file.`,
    },
    {
      title: 'Desktop Sync and Conflict Resolution',
      content: `Google Drive's desktop sync client must keep a local folder in perfect sync with the cloud state, handling offline edits, concurrent changes, and network interruptions.\n\n**Change feed**: The client maintains a sync cursor (a change token). Periodically, it asks the server for all changes since that cursor. The server returns a list of file metadata changes (created, modified, moved, deleted, permission changed).\n\n**File streaming vs mirroring**: Drive offers two modes. "Streaming" keeps files in the cloud and downloads on access (using a virtual filesystem). "Mirroring" maintains full local copies. Streaming drastically reduces disk usage but requires connectivity.\n\n**Conflict resolution**: When the same file is edited both locally (offline) and remotely, Drive creates a conflict copy (\"filename (conflict copy)\") rather than silently overwriting. For Google Docs files, OT handles conflicts at the operation level, so no conflict copies are needed.\n\n**Delta sync**: For large files, the client computes a rolling checksum (similar to rsync) to identify changed blocks and uploads only those blocks. The server reassembles the file from existing and new blocks.`,
    },
  ],
  tradeoffs: [
    {
      decision: 'Operational Transformation over CRDTs',
      pros: ['Proven at Google\'s scale for 15+ years', 'Central server simplifies conflict resolution', 'Smaller operation payloads than CRDT state'],
      cons: ['Requires a central server — no true P2P', 'Transform functions are complex and error-prone to implement', 'Harder to add new operation types'],
    },
    {
      decision: 'Content-addressed storage with deduplication',
      pros: ['Massive storage savings across billions of files', 'Efficient versioning — only new blocks stored', 'Built-in integrity verification via hashes'],
      cons: ['Hash computation adds upload latency', 'Garbage collection of unreferenced blocks is complex', 'Dedup ratio varies by file type'],
    },
    {
      decision: 'Spanner for metadata over traditional RDBMS',
      pros: ['Global consistency with external consistency guarantee', 'Horizontal scaling without manual sharding', 'Multi-region replication built-in'],
      cons: ['Higher latency for writes due to TrueTime synchronization', 'Complex operational model', 'Vendor lock-in to Google infrastructure'],
    },
  ],
};
