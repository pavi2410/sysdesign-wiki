import type { FeatureGuide } from './types';

export const fullTextSearch: FeatureGuide = {
  slug: 'full-text-search',
  title: 'Full-Text Search',
  tagline: 'Inverted indexes, relevance tuning, and search-as-you-type for any content type',
  category: 'data',
  tags: ['search', 'Elasticsearch', 'inverted-index', 'relevance', 'Typesense'],
  problem: `Users expect instant, relevant search results across all content — documents, products, messages, user profiles. SQL LIKE queries are too slow and lack relevance ranking. Full-text search requires specialized data structures (inverted indexes), text analysis (tokenization, stemming, synonyms), relevance scoring (TF-IDF, BM25), and query features like typo tolerance, faceted filtering, and autocomplete. The search index must stay in sync with the primary database, handle schema evolution, and scale to billions of documents with sub-100ms query latency.`,
  approaches: [
    {
      name: 'Elasticsearch / OpenSearch',
      description: `Deploy a dedicated search cluster using **Elasticsearch** or its fork **OpenSearch**. Index documents from your primary database. Query using the rich DSL for full-text search, aggregations, geospatial queries, and more. The industry standard for large-scale search.`,
      pros: [
        'Extremely mature — battle-tested at massive scale',
        'Rich query DSL: fuzzy matching, boosting, aggregations, geo',
        'Distributed architecture — scales horizontally by adding nodes',
        'Huge ecosystem: Kibana, Logstash, client libraries for every language',
      ],
      cons: [
        'Operationally complex — JVM tuning, shard management, cluster health',
        'High memory requirements (heap + OS cache)',
        'Eventual consistency between primary DB and search index',
        'Can be expensive to run (compute + storage)',
      ],
    },
    {
      name: 'Lightweight Search Engine (Typesense, Meilisearch)',
      description: `Use a purpose-built search engine optimized for simplicity and speed. **Typesense** and **Meilisearch** offer fast setup, typo tolerance out of the box, and simpler operational models. Ideal for product search, site search, and applications that don't need Elasticsearch's full feature set.`,
      pros: [
        'Instant setup — single binary, minimal configuration',
        'Built-in typo tolerance and relevance tuning',
        'Lower operational complexity than Elasticsearch',
        'Excellent search-as-you-type performance (<5ms)',
      ],
      cons: [
        'Smaller feature set than Elasticsearch',
        'Limited aggregation and analytics capabilities',
        'Smaller community and ecosystem',
        'May not scale to billions of documents',
      ],
    },
    {
      name: 'Database-Native Full-Text Search',
      description: `Use your existing database's built-in full-text search capabilities. PostgreSQL has excellent FTS with \`tsvector\`/\`tsquery\`, GIN indexes, and ranking functions. MySQL has FULLTEXT indexes. Avoids an additional system but with limited features.`,
      pros: [
        'No additional infrastructure — uses your existing database',
        'Strong consistency — search index updates in the same transaction',
        'Simpler architecture — fewer moving parts',
        'Good enough for many use cases (internal tools, simple search)',
      ],
      cons: [
        'Limited relevance tuning compared to dedicated engines',
        'No built-in typo tolerance or autocomplete',
        'Search queries compete for resources with OLTP workload',
        'Scaling search independently from the database is not possible',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Clients
        WEB[Web App]
        MOB[Mobile App]
    end
    subgraph API["API Layer"]
        SEARCH_API[Search API]
        WRITE_API[Write API]
    end
    subgraph Indexing["Indexing Pipeline"]
        CDC[Change Data Capture<br/>Debezium / Triggers]
        TRANSFORM[Transform &<br/>Enrich]
        INDEXER[Bulk Indexer]
    end
    subgraph Search["Search Cluster"]
        ES1[Search Node 1]
        ES2[Search Node 2]
        ES3[Search Node 3]
    end
    subgraph Storage
        DB[(Primary Database)]
        CACHE[(Query Cache<br/>Redis)]
    end
    WEB & MOB --> SEARCH_API
    SEARCH_API --> CACHE
    SEARCH_API --> ES1 & ES2 & ES3
    WEB & MOB --> WRITE_API
    WRITE_API --> DB
    DB --> CDC
    CDC --> TRANSFORM
    TRANSFORM --> INDEXER
    INDEXER --> ES1 & ES2 & ES3`,
  components: [
    { name: 'Search API', description: 'Receives search queries from clients, translates them into search engine queries (with filters, pagination, highlighting), executes against the search cluster, and formats results. Handles query parsing, spell correction suggestions, and result caching.' },
    { name: 'Indexing Pipeline', description: 'Keeps the search index in sync with the primary database. Uses Change Data Capture (Debezium for Postgres/MySQL, database triggers, or application-level events) to detect changes. Transforms raw database rows into search documents with computed fields (full name, concatenated text, denormalized relations).' },
    { name: 'Search Cluster', description: 'Distributed search engine (Elasticsearch, Typesense) storing the inverted index. Handles text analysis (tokenization, stemming, lowercasing), relevance scoring (BM25), and query execution. Sharded across nodes for horizontal scaling.' },
    { name: 'Query Cache', description: 'Redis-based cache for frequent and expensive search queries. Cache key includes the query string, filters, and pagination. Short TTL (30-60 seconds) to balance freshness and performance. Invalidated on index updates for critical searches.' },
    { name: 'Relevance Tuning Service', description: 'Manages search relevance configuration: field weights (title 3x, body 1x), boosting rules (newer documents scored higher), synonym dictionaries, and stop words. Changes can be applied without re-indexing by updating search templates.' },
    { name: 'Analytics Collector', description: 'Tracks search queries, results shown, and clicks. Powers search analytics (popular queries, zero-result queries, click-through rates) and feeds into relevance improvement (learn-to-rank models, query suggestions).' },
  ],
  dataModel: `erDiagram
    SEARCH_INDEX {
        string document_id PK
        string source_type
        string source_id FK
        json indexed_fields
        float[] embedding_vector
        timestamp indexed_at
        int version
    }
    SEARCH_SYNONYM {
        string synonym_id PK
        string index_name
        string[] terms
        boolean bidirectional
    }
    SEARCH_QUERY_LOG {
        string query_id PK
        string user_id FK
        string query_text
        json filters
        int result_count
        int click_position
        float latency_ms
        timestamp searched_at
    }
    SEARCH_CONFIG {
        string config_id PK
        string index_name
        json field_weights
        json boost_rules
        json analyzers
        timestamp updated_at
    }
    SEARCH_INDEX ||--o{ SEARCH_QUERY_LOG : returns
    SEARCH_CONFIG ||--|| SEARCH_INDEX : configures`,
  deepDive: [
    {
      title: 'Inverted Index Internals',
      content: `An inverted index maps terms to the documents that contain them — the opposite of a forward index (document → terms).\n\n**How it works**:\n1. **Analysis**: Text is processed through an analyzer chain:\n   - Tokenizer: "The quick brown fox" → ["The", "quick", "brown", "fox"]\n   - Lowercase filter: → ["the", "quick", "brown", "fox"]\n   - Stop word removal: → ["quick", "brown", "fox"]\n   - Stemmer: → ["quick", "brown", "fox"] (no change here, but "running" → "run")\n2. **Indexing**: Each term maps to a posting list of document IDs:\n   - "quick" → [doc1, doc5, doc12]\n   - "brown" → [doc1, doc7]\n   - "fox" → [doc1, doc3, doc7]\n3. **Querying**: For "quick fox", intersect the posting lists:\n   - "quick" ∩ "fox" → [doc1] (AND query)\n   - "quick" ∪ "fox" → [doc1, doc3, doc5, doc7, doc12] (OR query)\n\n**BM25 scoring**: The standard relevance algorithm considers term frequency (how often the term appears in the document), inverse document frequency (rarer terms are more important), and document length normalization (longer documents don't unfairly dominate).`,
    },
    {
      title: 'Keeping the Index in Sync',
      content: `The search index is a derived data store — the primary database is the source of truth. Keeping them in sync is the hardest operational challenge.\n\n**Approaches**:\n\n**Dual-write**: Application writes to both the database and the search index in the same request. Simple but fragile — if one write fails, they're out of sync. No atomicity guarantee.\n\n**Change Data Capture (CDC)**: Use Debezium to stream database changes (INSERT, UPDATE, DELETE) from the WAL/binlog to the indexing pipeline. Near real-time (1-5 second lag), reliable, and decoupled from application code. The gold standard.\n\n**Event-driven**: Application publishes domain events (OrderCreated, ProductUpdated) to a message bus. The indexing service consumes events and updates the index. Requires events to contain enough data to build the search document.\n\n**Periodic re-index**: Full re-index on a schedule (hourly, daily). Simple but creates a staleness window. Use as a safety net alongside CDC — periodically verify the index matches the database and repair divergences.\n\n**Handling deletes**: Soft-deletes in the database should trigger index removal. Hard-deletes require CDC or event-driven approaches — the record is gone from the database, so you can't query it for index updates.`,
    },
    {
      title: 'Search-as-You-Type and Autocomplete',
      content: `Instant search results as the user types requires special optimization:\n\n**Prefix matching**: Index terms as edge n-grams. "elasticsearch" → ["e", "el", "ela", "elas", ...]. Allows matching partial terms during typing. Increases index size but enables instant prefix search.\n\n**Completion suggester**: Elasticsearch's completion suggester uses a finite-state transducer (FST) stored entirely in memory. Extremely fast (<1ms) but only for exact prefix matches. Ideal for search box autocomplete.\n\n**Debouncing**: Don't send a query on every keystroke. Wait 150-300ms after the user stops typing before sending the query. Reduces server load by 70-80%.\n\n**Result caching**: Cache autocomplete results aggressively. "iph" → cached results for "iphone" suggestions. Short TTL (60-120 seconds) is fine since autocomplete results change infrequently.\n\n**Typo tolerance**: Typesense and Meilisearch handle this natively. For Elasticsearch, use fuzzy queries with an edit distance of 1-2. "iphne" matches "iphone" with edit distance 1.\n\n**Highlighting**: Return matching fragments with the search terms highlighted. Use Elasticsearch's highlight API or post-process with regex. Show highlighted snippets in the search dropdown for better UX.`,
    },
  ],
  realWorldExamples: [
    { system: 'GitHub', approach: 'Custom search infrastructure indexing 200M+ repositories. Uses Elasticsearch for code search with custom analyzers for programming languages (camelCase splitting, snake_case tokenization). Recently rewrote code search with a Rust-based engine (Blackbird) using trigram indexes.' },
    { system: 'Algolia', approach: 'Search-as-a-Service with a custom search engine (not Elasticsearch). Distributed across 70+ data centers for <10ms latency globally. Uses a tie-breaking ranking algorithm instead of traditional scoring for more predictable results.' },
    { system: 'Amazon', approach: 'Product search uses a custom engine evolved from A9. Combines text matching with behavioral signals (click-through rate, purchase rate, conversion) for relevance. Faceted search with dynamic filters based on the product category.' },
    { system: 'Notion', approach: 'Uses Elasticsearch for workspace search across pages, databases, and comments. Indexes are tenant-scoped. Supports search across nested database properties and rich-text content with permission-aware result filtering.' },
  ],
  tradeoffs: [
    {
      decision: 'Elasticsearch vs lightweight engine (Typesense/Meilisearch)',
      pros: ['ES: most features, largest community, proven at massive scale', 'Lightweight: simpler ops, faster setup, better defaults for search UX', 'ES: better for log analytics and complex aggregations'],
      cons: ['ES: operational complexity (JVM, shards, cluster management)', 'Lightweight: smaller scale ceiling, fewer features', 'ES: overkill for simple product/content search use cases'],
    },
    {
      decision: 'CDC vs dual-write for index sync',
      pros: ['CDC: reliable, decoupled, captures all changes including direct DB writes', 'Dual-write: simpler architecture, immediate index update', 'CDC: works across microservices without changing application code'],
      cons: ['CDC: additional infrastructure (Debezium, Kafka/Connect)', 'Dual-write: no atomicity, risk of inconsistency on partial failure', 'CDC: slight delay (1-5 seconds) between write and search visibility'],
    },
    {
      decision: 'Dedicated search service vs database-native FTS',
      pros: ['Dedicated: better relevance, typo tolerance, facets, autocomplete', 'DB-native: no extra infra, transactional consistency, simpler', 'Dedicated: can scale search independently from OLTP workload'],
      cons: ['Dedicated: another system to manage, sync challenges', 'DB-native: limited features, competes for DB resources', 'DB-native: harder to tune relevance and add search-specific features'],
    },
  ],
};
