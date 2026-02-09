import type { SystemDesign } from './types';

export const github: SystemDesign = {
  slug: 'github',
  name: 'GitHub',
  tagline: 'The world\'s largest code hosting platform powered by Git at scale',
  category: 'devtools',
  tags: ['git', 'code-hosting', 'CI/CD', 'developer-tools', 'collaboration', 'open-source'],
  overview: `GitHub is the world's largest source code hosting platform, serving 100M+ developers and hosting 400M+ repositories. Its architecture must handle massive Git operations (clone, push, pull) at scale, a sophisticated pull request review system, CI/CD pipelines via GitHub Actions, and a globally distributed CDN for repository access. Originally a Ruby on Rails monolith, GitHub has evolved into a service-oriented architecture while maintaining Git's decentralized model as its storage foundation. Acquired by Microsoft in 2018, GitHub runs on a hybrid of bare-metal servers and Azure cloud infrastructure.`,
  scale: {
    'Developers': '100M+',
    'Repositories': '400M+',
    'Daily Git operations': 'Billions',
    'Actions workflow runs/day': '30M+',
  },
  requirements: {
    functional: [
      'Git repository hosting (clone, push, pull, fork)',
      'Pull request creation, review, and merge',
      'CI/CD pipelines via GitHub Actions',
      'Issue tracking and project boards',
      'Code search across all public repositories',
      'Package registry (npm, Docker, Maven, etc.)',
      'GitHub Copilot AI-assisted coding',
    ],
    nonFunctional: [
      'High availability (99.99% uptime target)',
      'Low latency Git operations globally',
      'Support for monorepos with millions of files',
      'Secure isolation for Actions runners',
      'Consistent data — no lost commits or PRs',
      'Scalable search across 400M+ repositories',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        CLI[Git CLI]
        WEB[Web UI]
        API[REST / GraphQL API]
        COPI[Copilot]
    end
    subgraph Edge["Edge Layer"]
        LB[Load Balancer]
        PROXY[Git Proxy]
    end
    subgraph Services["Core Services"]
        RAILS[Rails Monolith]
        GITSVC[Git Backend Service]
        ACTIONS[Actions Service]
        SEARCH[Code Search]
        PR[Pull Request Service]
        PKG[Package Registry]
    end
    subgraph Storage["Storage Layer"]
        MYSQL[(MySQL Vitess)]
        REDIS[(Redis)]
        GIT[(Git Storage - NFS/Ceph)]
        BLOB[(Blob Storage)]
        QUEUE[(Job Queue)]
    end
    CLI --> PROXY
    WEB & API & COPI --> LB
    LB --> RAILS
    PROXY --> GITSVC
    RAILS --> PR & SEARCH & PKG
    RAILS --> MYSQL & REDIS
    GITSVC --> GIT
    ACTIONS --> QUEUE
    PKG --> BLOB
    SEARCH --> BLOB`,
  components: [
    { name: 'Git Backend Service', description: 'Handles all Git protocol operations (clone, fetch, push, receive-pack). Written in Go, it interfaces with the on-disk Git repositories stored on a distributed filesystem. Supports Git LFS for large file storage and partial clone for monorepo performance.' },
    { name: 'Rails Monolith', description: 'The original Ruby on Rails application that still powers the web UI, REST API, and much of the business logic. Handles authentication, repository settings, issues, pull requests, and user management. Being gradually decomposed into services.' },
    { name: 'Pull Request Service', description: 'Manages PR lifecycle — creation, diff generation, review assignments, status checks, merge strategies (merge commit, squash, rebase). Computes diffs by invoking the Git backend and caches them for repeated access.' },
    { name: 'GitHub Actions', description: 'A CI/CD platform that runs workflows on events (push, PR, schedule). Workflows are defined in YAML and executed on ephemeral virtual machines or containers. The service manages job queuing, runner allocation, artifact storage, and log streaming.' },
    { name: 'Code Search (Blackbird)', description: 'GitHub\'s code search engine, codenamed Blackbird, indexes 200M+ repositories. Built on a custom Rust-based search engine that supports regex, symbol-aware queries, and language-specific parsing. Uses a novel index sharding strategy.' },
    { name: 'Package Registry', description: 'Hosts packages for npm, Docker, Maven, NuGet, RubyGems, and more. Each ecosystem has its own resolution and metadata layer, but they share a common blob storage backend and CDN for package distribution.' },
  ],
  dataModel: `erDiagram
    USER {
        bigint user_id PK
        string login UK
        string email
        enum type
        timestamp created_at
    }
    REPOSITORY {
        bigint repo_id PK
        bigint owner_id FK
        string name
        boolean is_private
        string default_branch
        string disk_path
        bigint size_bytes
    }
    PULL_REQUEST {
        bigint pr_id PK
        bigint repo_id FK
        bigint author_id FK
        int number
        string title
        enum state
        string head_ref
        string base_ref
        timestamp created_at
        timestamp merged_at
    }
    ISSUE {
        bigint issue_id PK
        bigint repo_id FK
        bigint author_id FK
        int number
        string title
        enum state
        timestamp created_at
    }
    WORKFLOW_RUN {
        bigint run_id PK
        bigint repo_id FK
        string workflow_name
        enum status
        string commit_sha
        timestamp started_at
        timestamp completed_at
    }
    USER ||--o{ REPOSITORY : owns
    USER ||--o{ PULL_REQUEST : authors
    REPOSITORY ||--o{ PULL_REQUEST : has
    REPOSITORY ||--o{ ISSUE : has
    REPOSITORY ||--o{ WORKFLOW_RUN : triggers`,
  deepDive: [
    {
      title: 'Git Storage at Scale',
      content: `GitHub stores **400M+ Git repositories** on disk, requiring a carefully designed storage architecture.\n\n**Storage backend**: Repositories are stored as bare Git repositories on a distributed filesystem (historically NFS, evolving to Ceph-like systems). Each repository is a directory of Git objects (packfiles, loose objects, refs).\n\n**Replication**: Every repository is replicated across three storage nodes for durability. Writes go to the primary, and replicas are updated asynchronously. GitHub uses a custom replication framework that ensures consistency at the Git ref level.\n\n**Repository routing**: A routing layer maps each repository to its storage backend (which cluster, which shard). This allows GitHub to rebalance repositories across storage nodes without changing URLs.\n\n**Monorepo challenges**: Large repositories with millions of files and deep history are expensive to clone. GitHub supports partial clone (download objects on demand) and sparse checkout to mitigate this. Git packfile bitmaps accelerate object enumeration for large repos.`,
    },
    {
      title: 'GitHub Actions Architecture',
      content: `GitHub Actions is a full CI/CD platform built into GitHub, processing 30M+ workflow runs per day.\n\n**Event-driven**: Workflows are triggered by repository events (push, pull_request, release, schedule, etc.). The event is matched against YAML workflow definitions, and matching jobs are enqueued.\n\n**Runner infrastructure**: Jobs execute on ephemeral virtual machines (GitHub-hosted runners) or customer-managed self-hosted runners. Each GitHub-hosted runner is a fresh VM provisioned from a pre-baked image, ensuring isolation between jobs.\n\n**Job orchestration**: A workflow can define multiple jobs with dependency graphs. The orchestrator resolves dependencies, allocates runners, streams logs in real time, and collects artifacts.\n\n**Secrets management**: Secrets are encrypted at rest using libsodium sealed boxes. They are injected into the runner environment at execution time and never logged.\n\n**Artifact and cache storage**: Build artifacts and dependency caches are stored in Azure Blob Storage with per-repository quotas and automatic expiration.`,
      diagram: `sequenceDiagram
    participant DEV as Developer
    participant GH as GitHub
    participant ORCH as Orchestrator
    participant RUNNER as Runner VM
    participant STORE as Artifact Store
    DEV->>GH: git push
    GH->>ORCH: Trigger workflow event
    ORCH->>ORCH: Match workflow YAML
    ORCH->>RUNNER: Provision ephemeral VM
    RUNNER->>GH: Checkout code
    RUNNER->>RUNNER: Execute steps
    RUNNER->>STORE: Upload artifacts
    RUNNER->>ORCH: Report status
    ORCH->>GH: Update commit status`,
    },
    {
      title: 'Code Search with Blackbird',
      content: `GitHub's code search engine, **Blackbird**, enables regex and symbol-aware search across 200M+ repositories.\n\n**Indexing**: Blackbird crawls Git repositories and indexes their contents using a custom Rust-based indexer. It builds trigram and n-gram indices for fast substring matching, plus language-aware symbol tables for jump-to-definition queries.\n\n**Sharding**: The search index is sharded by repository. Popular repositories and those belonging to paying customers are indexed with higher priority. The total index size is in the petabyte range.\n\n**Query execution**: A query like \`language:go repo:kubernetes/kubernetes func.*Handler\` is decomposed into a filter phase (language, repo scope) and a search phase (regex matching against the filtered index). Results are ranked by repository popularity and match quality.\n\n**Incremental updates**: When a push event occurs, only the changed files are re-indexed. This keeps the index fresh within minutes of a push, even at GitHub's scale.`,
    },
  ],
  tradeoffs: [
    {
      decision: 'Ruby on Rails monolith with gradual decomposition',
      pros: ['Rapid feature development on a mature codebase', 'Single deployment unit simplifies operations', 'Deep institutional knowledge of the codebase'],
      cons: ['Scaling bottlenecks in the monolith', 'Long CI/CD cycles for the main app', 'Difficult to assign clear ownership of components'],
    },
    {
      decision: 'Bare Git repositories on distributed filesystem',
      pros: ['Leverages Git\'s battle-tested storage format', 'No abstraction layer — direct filesystem access is fast', 'Compatible with all Git tooling'],
      cons: ['Filesystem-level sharding is operationally complex', 'NFS can be a bottleneck for hot repositories', 'Garbage collection and repacking require careful scheduling'],
    },
    {
      decision: 'Ephemeral VMs for Actions runners',
      pros: ['Strong isolation between jobs', 'Clean environment prevents state leakage', 'Predictable and reproducible builds'],
      cons: ['VM provisioning adds cold-start latency', 'Higher cost than container-based runners', 'Limited customization compared to self-hosted runners'],
    },
  ],
};
