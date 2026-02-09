import type { FeatureGuide } from './types';

export const recommendationEngine: FeatureGuide = {
  slug: 'recommendation-engine',
  title: 'Recommendation Engine',
  tagline: 'Collaborative filtering, content-based, and hybrid approaches to personalized suggestions',
  category: 'data',
  tags: ['recommendations', 'ML', 'collaborative-filtering', 'personalization', 'ranking'],
  problem: `Users are overwhelmed by choice. E-commerce sites have millions of products, streaming platforms have tens of thousands of titles, and social feeds contain endless content. A recommendation engine surfaces the most relevant items for each user by learning from their behavior (clicks, purchases, watch time) and finding patterns across all users. The system must generate recommendations with low latency (<100ms), update as new signals arrive, handle the cold-start problem (new users/items with no history), and balance exploration (new content) with exploitation (known preferences).`,
  approaches: [
    {
      name: 'Collaborative Filtering',
      description: `Recommend items based on what similar users liked. **User-based**: "Users who liked items A, B, C also liked item D — and you liked A, B, C, so you might like D." **Item-based**: "Users who liked item A also liked item B." No understanding of content is needed — purely behavioral signals.`,
      pros: [
        'Works without understanding content — purely behavioral',
        'Discovers non-obvious connections (serendipitous recommendations)',
        'Improves automatically as more user data is collected',
        'Item-based CF is highly scalable and cacheable',
      ],
      cons: [
        'Cold-start problem — can\'t recommend for new users or new items',
        'Popularity bias — tends to recommend already-popular items',
        'Sparse data — most users interact with a tiny fraction of items',
        'User-based CF is computationally expensive at scale',
      ],
    },
    {
      name: 'Content-Based Filtering',
      description: `Recommend items similar to what the user has liked before, based on item attributes. If a user likes action movies from the 2000s starring Tom Cruise, recommend other items with similar attributes. Uses item features (genre, tags, text embeddings) and user preference profiles.`,
      pros: [
        'No cold-start for new users if they provide preferences',
        'Recommends new items that match the user\'s taste profile',
        'Transparent — easy to explain why an item was recommended',
        'Works with a single user\'s data (no need for other users)',
      ],
      cons: [
        'Limited diversity — only recommends similar items (filter bubble)',
        'Requires good item metadata or feature extraction',
        'Cold-start for new items without rich metadata',
        'Can\'t capture complex taste patterns (mood, context)',
      ],
    },
    {
      name: 'Hybrid / Deep Learning Approach',
      description: `Combine collaborative filtering, content-based signals, and contextual features in a unified model. Modern systems use **deep learning** (two-tower models, transformers) that embed users and items into a shared vector space and compute similarity. Combine with a ranking model that considers dozens of features.`,
      pros: [
        'Best recommendation quality — captures complex patterns',
        'Handles cold-start with content features for new items',
        'Can incorporate contextual signals (time, device, location)',
        'State of the art for major platforms (Netflix, YouTube, TikTok)',
      ],
      cons: [
        'Requires significant ML expertise and infrastructure',
        'Training pipeline is complex (data collection, feature engineering, model training)',
        'Harder to debug and explain recommendations',
        'Higher computational cost for training and serving',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph DataCollection["Data Collection"]
        CLICK[Clickstream<br/>Events]
        PURCHASE[Purchase<br/>Events]
        RATING[Explicit<br/>Ratings]
    end
    subgraph Pipeline["ML Pipeline"]
        FE[Feature<br/>Engineering]
        TRAIN[Model<br/>Training]
        EVAL[Offline<br/>Evaluation]
    end
    subgraph Serving["Serving Layer"]
        CAND[Candidate<br/>Generation]
        RANK[Ranking<br/>Model]
        FILTER[Business<br/>Rules Filter]
        API[Recommendation<br/>API]
    end
    subgraph Storage
        DW[(Data Warehouse<br/>Training Data)]
        VS[(Vector Store<br/>Embeddings)]
        CACHE[(Redis Cache<br/>Pre-computed)]
        DB[(Item Catalog)]
    end
    CLICK & PURCHASE & RATING --> DW
    DW --> FE
    FE --> TRAIN
    TRAIN --> EVAL
    TRAIN --> VS
    API --> CAND
    CAND --> VS
    CAND --> RANK
    RANK --> FILTER
    FILTER --> CACHE
    API --> CACHE
    CAND --> DB`,
  components: [
    { name: 'Candidate Generation', description: 'First stage of the recommendation pipeline. Retrieves a broad set of candidate items (~1000) from the full catalog using fast approximate methods: ANN (Approximate Nearest Neighbor) search on embeddings, item-based CF lookup tables, or rule-based filters (same category, trending items).' },
    { name: 'Ranking Model', description: 'Second stage that scores and ranks the candidates. A more expensive model that considers detailed features: user history, item attributes, contextual signals, and interaction patterns. Outputs a relevance score for each candidate. Typically a gradient boosted tree or neural network.' },
    { name: 'Feature Store', description: 'Centralized store of pre-computed features for users and items. User features: interaction history, preference vector, demographic segments. Item features: metadata, popularity scores, embedding vectors. Serves features at low latency for real-time scoring.' },
    { name: 'Vector Store', description: 'Stores embedding vectors for users and items. Supports Approximate Nearest Neighbor (ANN) search for fast similarity lookup. Options: Pinecone, Weaviate, Qdrant, or FAISS for self-hosted. Updated as models are retrained.' },
    { name: 'Training Pipeline', description: 'Batch pipeline that trains recommendation models on historical interaction data. Runs on a schedule (daily/weekly) using Spark, PyTorch, or TensorFlow. Outputs model artifacts and updated embedding vectors. Includes offline evaluation (precision, recall, NDCG).' },
    { name: 'A/B Testing Framework', description: 'Routes users to different recommendation algorithms or model versions. Measures engagement metrics (CTR, conversion, watch time) per variant. Essential for iterating on recommendation quality. Integrates with the feature flag system.' },
  ],
  dataModel: `erDiagram
    USER_PROFILE {
        string user_id PK
        float[] preference_vector
        json interaction_counts
        string[] preferred_categories
        timestamp last_active
    }
    ITEM {
        string item_id PK
        string title
        string category
        json attributes
        float[] embedding_vector
        float popularity_score
    }
    INTERACTION {
        string interaction_id PK
        string user_id FK
        string item_id FK
        enum type
        float value
        json context
        timestamp created_at
    }
    RECOMMENDATION {
        string rec_id PK
        string user_id FK
        string item_id FK
        float score
        string model_version
        string source
        timestamp generated_at
    }
    USER_PROFILE ||--o{ INTERACTION : generates
    ITEM ||--o{ INTERACTION : receives
    USER_PROFILE ||--o{ RECOMMENDATION : gets
    ITEM ||--o{ RECOMMENDATION : appears_in`,
  deepDive: [
    {
      title: 'Two-Tower Architecture',
      content: `The **two-tower model** is the standard architecture for large-scale recommendation candidate generation.\n\n**How it works**:\n- **User tower**: A neural network that takes user features (history, demographics, context) and outputs a fixed-size embedding vector representing the user's current interests.\n- **Item tower**: A separate neural network that takes item features (metadata, content, popularity) and outputs a fixed-size embedding vector.\n- **Training**: Both towers are trained jointly so that the dot product of a user embedding and an item embedding predicts the probability of interaction (click, purchase, watch).\n- **Serving**: Pre-compute all item embeddings and store in a vector index (FAISS, ScaNN). At request time, compute the user embedding on-the-fly and find the nearest item embeddings via ANN search.\n\n**Why two towers?**: The item embeddings can be pre-computed and indexed offline, making retrieval extremely fast (<10ms for top-K from millions of items). Only the user embedding needs real-time computation.\n\n**Limitations**: The dot-product interaction between towers is a simplification. Complex cross-features (user X watched action movies on weekends but comedies on weekdays) require a downstream ranking model with richer feature interactions.`,
    },
    {
      title: 'Cold-Start Strategies',
      content: `New users and new items have no interaction history, making collaborative filtering useless.\n\n**New user cold-start**:\n- **Onboarding quiz**: Ask users to pick favorite genres, topics, or sample items. Bootstrap the preference vector from these explicit signals.\n- **Popularity-based**: Show globally popular items until enough interactions are collected (typically 5-10 interactions to build a basic profile).\n- **Demographic-based**: Use registration data (age, location, language) to match with similar user segments.\n- **Contextual**: Use device type, referral source, and time of day as weak signals.\n\n**New item cold-start**:\n- **Content-based features**: Use item metadata (title, description, category, images) to generate an initial embedding. Even without interactions, the item can be recommended based on content similarity to items the user liked.\n- **Exploration budget**: Reserve 5-10% of recommendation slots for new items. Track engagement and graduate items to the main algorithm once they have sufficient signal.\n- **Boosting**: Artificially boost new items' scores for a limited time to collect interaction data faster.\n\n**Bandit approach**: Use multi-armed bandit algorithms (Thompson Sampling, UCB) to balance exploitation (recommend known-good items) with exploration (try new items to learn about them).`,
    },
    {
      title: 'Real-Time vs Batch Recommendations',
      content: `**Batch pre-computation**: Generate recommendations for all users periodically (hourly, daily). Store in Redis/Cassandra. Reading is a simple lookup — ultra-fast. But recommendations are stale between updates.\n\n**Real-time scoring**: Compute recommendations on request. Uses the latest user signals (they just searched for "winter jacket" — show jacket recommendations immediately). Higher latency but more relevant.\n\n**Hybrid approach** (most common):\n1. **Batch**: Pre-compute candidate sets and user/item embeddings nightly\n2. **Near-real-time**: Update user features (recent interactions) in a streaming pipeline (Kafka → Flink)\n3. **Request-time**: Re-rank pre-computed candidates using the latest user features\n\n**Latency budget example**:\n- Candidate retrieval (ANN search): 5ms\n- Feature lookup (feature store): 3ms\n- Model inference (ranking): 10ms\n- Business rules + filtering: 2ms\n- Total: ~20ms per request\n\nPre-computed recommendations are cached with a 1-hour TTL. Real-time re-ranking happens on cache miss or when significant new signals arrive (purchase, explicit rating).`,
    },
  ],
  realWorldExamples: [
    { system: 'Netflix', approach: 'Uses a multi-stage pipeline: candidate generation with collaborative filtering and content-based methods, then ranking with a neural network considering hundreds of features. Personalizes not just which titles to show, but the artwork displayed for each title.' },
    { system: 'YouTube', approach: 'Two-tower deep learning model for candidate generation from hundreds of millions of videos. Deep ranking network considers user history, video features, and context. Optimizes for watch time, not just click-through rate.' },
    { system: 'Amazon', approach: 'Item-to-item collaborative filtering is the core ("customers who bought X also bought Y"). Pre-computed item similarity tables updated hourly. Combined with session-based recommendations for real-time personalization.' },
    { system: 'Spotify', approach: 'Combines collaborative filtering (similar listeners), content analysis (audio features extracted by ML), and NLP (playlist names, blog posts about music). "Discover Weekly" uses a matrix factorization model trained on listening history.' },
  ],
  tradeoffs: [
    {
      decision: 'Collaborative filtering vs content-based',
      pros: ['CF: discovers non-obvious connections, no content understanding needed', 'Content-based: handles cold-start, transparent recommendations', 'Hybrid: best of both worlds, most accurate'],
      cons: ['CF: cold-start problem, popularity bias', 'Content-based: filter bubble, needs good metadata', 'Hybrid: most complex to build and maintain'],
    },
    {
      decision: 'Pre-computed vs real-time recommendations',
      pros: ['Pre-computed: lowest latency, simplest serving', 'Real-time: most relevant, incorporates latest signals', 'Hybrid with re-ranking: good balance'],
      cons: ['Pre-computed: stale, misses recent intent signals', 'Real-time: higher latency, more compute per request', 'Hybrid: complex pipeline with batch + streaming + serving components'],
    },
    {
      decision: 'Optimize for engagement vs diversity',
      pros: ['Engagement: maximizes clicks/watch time, clear business metric', 'Diversity: prevents filter bubbles, improves discovery', 'Blended objective: engagement with diversity penalty term'],
      cons: ['Engagement-only: creates echo chambers, narrows user experience', 'Diversity-only: lower immediate engagement metrics', 'Blended: harder to tune the right balance, varies by user'],
    },
  ],
};
