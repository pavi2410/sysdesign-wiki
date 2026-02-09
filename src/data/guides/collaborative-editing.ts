import type { FeatureGuide } from './types';

export const collaborativeEditing: FeatureGuide = {
  slug: 'collaborative-editing',
  title: 'Collaborative Real-Time Editing',
  tagline: 'CRDTs vs Operational Transform for conflict-free concurrent document editing',
  category: 'collaboration',
  tags: ['CRDT', 'OT', 'collaboration', 'real-time', 'conflict-resolution'],
  problem: `Google Docs, Figma, and Notion allow multiple users to edit the same document simultaneously without conflicts. This requires solving one of the hardest problems in distributed systems: concurrent edits on shared state. When Alice inserts "hello" at position 5 while Bob deletes character 3, both operations must be applied on both clients to produce the same final document — regardless of the order they arrive. The system must handle network latency, offline edits, cursor/selection tracking, and undo/redo, all while feeling instantaneous to each user.`,
  approaches: [
    {
      name: 'Operational Transform (OT)',
      description: `Each edit is represented as an **operation** (insert, delete, retain). When concurrent operations arrive, a **transform function** adjusts their positions so they can be applied in any order and produce the same result. The server acts as a central authority that orders operations. Used by Google Docs.`,
      pros: [
        'Well-understood — decades of research and production use',
        'Compact operations — efficient over the network',
        'Central server simplifies conflict resolution',
        'Good support for rich text (formatting, embeds)',
      ],
      cons: [
        'Transform functions are notoriously hard to get right',
        'Requires a central server for operation ordering',
        'Doesn\'t work well offline or in peer-to-peer scenarios',
        'Complexity explodes with rich document types (tables, nested structures)',
      ],
    },
    {
      name: 'Conflict-Free Replicated Data Types (CRDTs)',
      description: `CRDTs are data structures that can be modified independently on multiple replicas and **always converge** to the same state when merged — without coordination. Each character/element has a unique ID that determines its position, making concurrent inserts/deletes naturally commutative. No central server needed.`,
      pros: [
        'Mathematically guaranteed convergence — no conflicts by design',
        'Works offline — edits merge cleanly when reconnected',
        'No central server required — supports peer-to-peer',
        'Simpler mental model — just merge states, no transform functions',
      ],
      cons: [
        'Higher memory overhead — each character needs a unique ID and metadata',
        'Document tombstones accumulate (deleted elements are marked, not removed)',
        'Garbage collection of tombstones requires coordination',
        'Fewer production-proven implementations than OT',
      ],
    },
    {
      name: 'Hybrid: CRDT with Server Authority',
      description: `Use a CRDT for conflict resolution but route all operations through a central server for ordering, persistence, and access control. Combines CRDT's convergence guarantees with server-side features (undo history, permissions, search indexing). This is the approach used by Figma and increasingly by modern editors.`,
      pros: [
        'CRDT convergence with server-side features',
        'Server provides canonical ordering and persistence',
        'Offline edits merge cleanly via CRDT',
        'Server can enforce permissions and validate operations',
      ],
      cons: [
        'Complexity of both CRDT and server coordination',
        'Must handle divergence between optimistic local state and server state',
        'CRDT metadata overhead still applies',
        'Server becomes a dependency (though offline mode is possible)',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Clients
        C1[Client A<br/>Local CRDT Replica]
        C2[Client B<br/>Local CRDT Replica]
        C3[Client C<br/>Local CRDT Replica]
    end
    subgraph Server["Collaboration Server"]
        WS[WebSocket<br/>Gateway]
        SYNC[Sync Engine<br/>CRDT / OT]
        AUTH[Permission<br/>Check]
        CURSOR[Cursor &<br/>Presence Tracker]
    end
    subgraph Storage
        DOC[(Document Store<br/>PostgreSQL)]
        SNAP[(Snapshot Store<br/>S3)]
        HISTORY[(Operation<br/>History)]
    end
    C1 & C2 & C3 <-->|WebSocket| WS
    WS --> AUTH
    WS --> SYNC
    WS --> CURSOR
    SYNC --> DOC
    SYNC --> HISTORY
    DOC -->|Periodic snapshot| SNAP
    CURSOR --> C1 & C2 & C3`,
  components: [
    { name: 'CRDT/OT Engine', description: 'Core algorithm that handles concurrent edit merging. For CRDTs: Yjs, Automerge, or Diamond Types. For OT: ShareDB or custom implementation. Runs on both client (for local application) and server (for canonical state). Must handle all document operations: insert, delete, format, move.' },
    { name: 'WebSocket Sync Layer', description: 'Bidirectional real-time connection for exchanging operations between clients and server. Clients send local operations immediately for low-latency feel. Server broadcasts operations to all connected clients. Handles reconnection with state sync (send missed operations or full document state).' },
    { name: 'Cursor & Presence Tracker', description: 'Tracks each user\'s cursor position, text selection, and active status. Broadcasts cursor updates to all clients for collaborative awareness (colored cursors with user names). Cursor positions must be transformed when concurrent edits shift text positions.' },
    { name: 'Document Store', description: 'Persists the canonical document state. For CRDTs, stores the serialized CRDT state (or operation log that can rebuild it). For OT, stores the document state plus the operation history. Periodic snapshots reduce the cost of loading documents (don\'t need to replay entire history).' },
    { name: 'Version History', description: 'Stores named snapshots and the complete operation log. Enables "version history" UI (view/restore past versions). For CRDTs, each snapshot is a serialized CRDT state. Operation log enables granular undo per user (undo only my operations, not others\').' },
    { name: 'Permission Service', description: 'Controls who can view, edit, or comment on each document. Checks permissions on every incoming operation. Must handle real-time permission changes (revoke access while user is editing — disconnect their WebSocket and discard pending operations).' },
  ],
  dataModel: `erDiagram
    DOCUMENT {
        string document_id PK
        string title
        string owner_id FK
        bytes crdt_state
        int version
        timestamp created_at
        timestamp updated_at
    }
    DOCUMENT_SNAPSHOT {
        string snapshot_id PK
        string document_id FK
        bytes state
        int version
        string label
        timestamp created_at
    }
    OPERATION {
        string op_id PK
        string document_id FK
        string user_id FK
        bytes operation_data
        int version
        timestamp created_at
    }
    COLLABORATOR {
        string document_id FK
        string user_id FK
        enum permission
        timestamp joined_at
    }
    DOCUMENT ||--o{ DOCUMENT_SNAPSHOT : snapshots
    DOCUMENT ||--o{ OPERATION : has
    DOCUMENT ||--o{ COLLABORATOR : shared_with`,
  deepDive: [
    {
      title: 'How CRDTs Work for Text',
      content: `Text CRDTs assign each character a **unique, globally ordered ID** that determines its position in the document, independent of array indexes.\n\n**Yjs approach (YATA algorithm)**:\n- Each character has an ID: (clientID, clock) — e.g., (Alice, 5)\n- Each character knows its left neighbor's ID\n- When inserting between two characters, the new character's position is determined by its left neighbor, making concurrent inserts at the same position deterministic\n- Deletes mark characters as tombstones (logically deleted but still in the structure)\n\n**Example of concurrent edits**:\n- Document: "AC"\n- Alice inserts "B" between A and C → "ABC"\n- Bob inserts "X" between A and C → "AXC" (concurrently)\n- When both operations are merged, the CRDT determines a consistent ordering: "ABXC" or "AXBC" — the same on both clients, determined by the character IDs\n\n**Why it always converges**: The unique IDs and ordering rules are **commutative** — applying Alice's edit then Bob's produces the same result as applying Bob's then Alice's. This is the mathematical guarantee of CRDTs.\n\n**Libraries**:\n- **Yjs**: Most popular, small bundle (15KB), supports ProseMirror, CodeMirror, Monaco, Tiptap\n- **Automerge**: Research-quality, supports JSON documents, Rust core with WASM bindings\n- **Diamond Types**: Rust-based, extremely memory-efficient, designed for performance`,
    },
    {
      title: 'Awareness and Cursor Synchronization',
      content: `Seeing other users' cursors and selections is essential for the collaborative experience.\n\n**Awareness protocol** (Yjs):\n- Each client broadcasts its "awareness state": cursor position, selection range, user name, user color\n- Updates sent via WebSocket alongside document operations\n- Awareness states have a 30-second timeout — if not refreshed, the user is considered disconnected\n\n**Cursor position challenges**:\n- Cursor positions are indexes into the document. When another user inserts text before your cursor, your cursor position must shift.\n- For OT: transform cursor positions using the same transform functions as text operations\n- For CRDTs: store cursor position as a reference to a character ID (not an index). The cursor "follows" the character regardless of insertions/deletions around it.\n\n**Visual design**:\n- Each user gets a distinct color (from a predefined palette)\n- Show a thin vertical line (caret) at their cursor position\n- Show a colored highlight for their selection range\n- Display the user's name in a small label above the cursor\n- Fade out cursors of idle users (no activity for 60 seconds)\n\n**Performance**: Don't send cursor updates on every keystroke. Throttle to 50-100ms intervals. Use a separate "awareness" channel that's lower priority than document operations.`,
    },
    {
      title: 'Offline Editing and Conflict Resolution',
      content: `True offline support is a key advantage of CRDTs over OT.\n\n**Offline workflow**:\n1. User edits the document while disconnected. All operations are applied to the local CRDT replica.\n2. On reconnection, the client sends its accumulated operations to the server.\n3. The server merges the operations with any changes made by other users during the disconnection.\n4. The server sends back any operations the offline client missed.\n5. Both sides converge to the same state — guaranteed by the CRDT.\n\n**No conflicts**: Unlike traditional merge (Git-style with conflict markers), CRDTs never produce conflicts. Concurrent edits to the same paragraph always merge deterministically. The result may not be what either user intended (if they edited the same sentence), but it's always a valid document state.\n\n**Long offline periods**: If a user is offline for days, the merge may produce unexpected results. Consider showing a "merge preview" UI that highlights what changed while they were away, similar to a diff view.\n\n**OT limitations**: Traditional OT requires a central server to order operations. Offline OT is possible (Google Docs buffers operations and sends on reconnect) but requires the server to be available to reconcile. Extended offline editing with OT is fragile.\n\n**Storage**: Offline clients must store their local CRDT state and pending operations in IndexedDB or SQLite. On reconnection, sync the pending operations first, then verify convergence by comparing document checksums.`,
    },
  ],
  realWorldExamples: [
    { system: 'Google Docs', approach: 'Uses Operational Transform with a central server. Each keystroke generates an operation sent to Google\'s servers, which transform and broadcast to other clients. The server maintains the canonical document state. Supports offline editing by buffering operations.' },
    { system: 'Figma', approach: 'Custom CRDT implementation for the design canvas. Each object on the canvas is a CRDT with properties that can be independently modified. Server acts as a relay and persistence layer. Handles complex operations like moving objects between frames.' },
    { system: 'Notion', approach: 'Block-based document model with OT-inspired sync. Each block (paragraph, heading, list item) is independently editable. Operations are block-level (insert block, update block content, move block). Server maintains block ordering and content.' },
    { system: 'Linear', approach: 'Uses CRDTs (Automerge-inspired) for offline-first issue tracking. All issue fields are CRDT properties that merge on sync. Supports full offline mode — create, edit, and comment on issues without connectivity. Syncs when back online.' },
  ],
  tradeoffs: [
    {
      decision: 'OT vs CRDT for text collaboration',
      pros: ['OT: compact operations, lower memory overhead', 'CRDT: guaranteed convergence, works offline/peer-to-peer', 'OT: more mature for rich text (decades of research)'],
      cons: ['OT: transform functions are error-prone, needs central server', 'CRDT: higher memory (unique IDs per character), tombstone accumulation', 'CRDT: fewer production-proven rich text implementations'],
    },
    {
      decision: 'Server-authoritative vs peer-to-peer sync',
      pros: ['Server: central persistence, access control, easier debugging', 'P2P: works without server, lower latency between nearby peers', 'Server: canonical state for search indexing and version history'],
      cons: ['Server: single point of failure, added latency hop', 'P2P: complex NAT traversal, no central authority for permissions', 'P2P: harder to implement version history and admin features'],
    },
    {
      decision: 'Character-level vs block-level sync',
      pros: ['Character: finest granularity, best for text-heavy editing', 'Block: simpler, fewer operations, natural for structured documents', 'Character: handles concurrent edits within the same paragraph'],
      cons: ['Character: more operations, higher bandwidth and processing', 'Block: concurrent edits to the same block can conflict', 'Block: less smooth for pure text editing (entire block replaced)'],
    },
  ],
};
