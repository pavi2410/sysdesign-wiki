import type { SystemDesign } from './types';

export const chatgpt: SystemDesign = {
  slug: 'chatgpt',
  name: 'ChatGPT',
  tagline: 'Serving large language model inference to hundreds of millions of users',
  category: 'ai',
  tags: ['ai', 'LLM', 'inference', 'GPU', 'real-time', 'streaming', 'transformer'],
  overview: `ChatGPT is OpenAI's conversational AI product, serving 200M+ weekly active users with access to GPT-4 class large language models. Its architecture addresses the unique challenges of LLM serving: extremely GPU-intensive inference, token-by-token streaming responses, multi-turn conversation context management, tool use (code execution, web browsing, image generation), and a plugin/function-calling ecosystem. The system must balance throughput (requests per second) with latency (time to first token) while managing GPU clusters costing hundreds of millions of dollars.`,
  scale: {
    'Weekly active users': '200M+',
    'Requests per day': 'Billions',
    'Model parameters': '1T+ (GPT-4 class)',
    'GPU cluster size': '10,000s of GPUs',
  },
  requirements: {
    functional: [
      'Multi-turn conversational chat with context retention',
      'Token-by-token streaming responses',
      'Tool use: code interpreter, web browsing, DALL-E image generation',
      'File upload and document analysis',
      'Custom GPTs with system prompts and knowledge files',
      'API access for developers (Chat Completions, Assistants)',
      'Voice input/output mode',
    ],
    nonFunctional: [
      'Low time-to-first-token (<1 second)',
      'High throughput across millions of concurrent conversations',
      'Efficient GPU utilization (>80% MFU)',
      'Graceful degradation under load (queuing, rate limiting)',
      'Content safety filtering with low false positive rate',
      'Global availability with regional data residency',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        WEB[Web App]
        MOB[Mobile App]
        API_C[API Clients]
    end
    subgraph Edge["Edge / API Layer"]
        LB[Load Balancer]
        APIGW[API Gateway]
        AUTH[Auth & Rate Limiter]
    end
    subgraph Orchestration["Orchestration Layer"]
        ROUTER[Model Router]
        CONV[Conversation Manager]
        TOOL[Tool Orchestrator]
    end
    subgraph Inference["Inference Layer"]
        SCHED[Request Scheduler]
        GPU1[GPU Cluster - GPT-4]
        GPU2[GPU Cluster - GPT-4o]
        GPU3[GPU Cluster - GPT-4o-mini]
    end
    subgraph Tools["Tool Services"]
        CODE[Code Interpreter]
        BROWSE[Web Browser]
        DALLE[DALL-E]
        RETRIEVAL[Retrieval / RAG]
    end
    subgraph Storage["Storage"]
        CONVDB[(Conversation Store)]
        FILEDB[(File Store)]
        CACHE[(KV Cache Store)]
        SAFETY[(Safety Classifier)]
    end
    WEB & MOB & API_C --> LB
    LB --> APIGW --> AUTH
    AUTH --> ROUTER
    ROUTER --> CONV
    CONV --> SCHED
    SCHED --> GPU1 & GPU2 & GPU3
    ROUTER --> TOOL
    TOOL --> CODE & BROWSE & DALLE & RETRIEVAL
    CONV --> CONVDB
    CONV --> FILEDB
    SCHED --> CACHE
    AUTH --> SAFETY`,
  components: [
    { name: 'API Gateway & Rate Limiter', description: 'Handles authentication (API keys, session tokens), rate limiting (per-user, per-tier), and request routing. Implements token-based rate limits — each request consumes tokens proportional to input + output length.' },
    { name: 'Model Router', description: 'Routes requests to the appropriate model cluster based on the requested model (GPT-4, GPT-4o, GPT-4o-mini), user tier (free vs Plus vs Enterprise), and current cluster load. Implements overflow routing when primary clusters are at capacity.' },
    { name: 'Conversation Manager', description: 'Manages multi-turn conversation state. Assembles the full prompt from conversation history, system prompts (for Custom GPTs), and tool results. Handles context window management — truncating or summarizing old messages when the conversation exceeds the model\'s context length.' },
    { name: 'Request Scheduler', description: 'The core inference scheduler that batches incoming requests for efficient GPU utilization. Implements continuous batching — new requests join a running batch without waiting for all current requests to complete. Manages the KV cache allocation on GPU memory.' },
    { name: 'GPU Inference Cluster', description: 'Clusters of NVIDIA H100/A100 GPUs running model inference. Each model instance is distributed across multiple GPUs using tensor parallelism (within a node) and pipeline parallelism (across nodes). Uses custom inference kernels optimized with CUDA.' },
    { name: 'Tool Orchestrator', description: 'Coordinates tool calls when the model decides to use tools. Executes code interpreter sessions in sandboxed containers, fetches web pages for browsing, triggers DALL-E for image generation, and runs retrieval against uploaded documents.' },
    { name: 'Safety Classifier', description: 'Runs content moderation on both inputs and outputs. A separate lightweight model classifies content against policy categories. Operates inline with low latency to avoid delaying responses.' },
  ],
  dataModel: `erDiagram
    USER {
        string user_id PK
        string email
        enum tier
        int rate_limit_tpm
        timestamp created_at
    }
    CONVERSATION {
        string conversation_id PK
        string user_id FK
        string title
        string model
        string system_prompt
        timestamp created_at
        timestamp updated_at
    }
    MESSAGE {
        string message_id PK
        string conversation_id FK
        enum role
        string content
        json tool_calls
        json attachments
        int token_count
        timestamp created_at
    }
    CUSTOM_GPT {
        string gpt_id PK
        string creator_id FK
        string name
        string instructions
        json tools_enabled
        json knowledge_files
    }
    USER ||--o{ CONVERSATION : has
    CONVERSATION ||--o{ MESSAGE : contains
    USER ||--o{ CUSTOM_GPT : creates`,
  deepDive: [
    {
      title: 'LLM Inference and Continuous Batching',
      content: `Serving a large language model efficiently is the central technical challenge of ChatGPT's architecture.\n\n**Autoregressive generation**: LLMs generate tokens one at a time. Each token requires a full forward pass through the model. For a 200-token response, that's 200 sequential forward passes — the main source of latency.\n\n**KV cache**: To avoid recomputing attention for all previous tokens on each step, the model caches key-value pairs from previous tokens. This KV cache grows linearly with sequence length and is the primary consumer of GPU memory.\n\n**Continuous batching**: Traditional batching waits for a batch of requests to complete before starting new ones. Continuous batching (also called iteration-level batching) allows new requests to join a running batch at any iteration. When a request in the batch finishes (generates its EOS token), its GPU memory slot is immediately freed for a new request. This dramatically improves GPU utilization.\n\n**PagedAttention**: The KV cache is managed using paged memory allocation (inspired by OS virtual memory). Instead of pre-allocating a contiguous block of GPU memory for each request's maximum possible sequence length, memory is allocated in small pages as needed. This reduces memory waste by ~60%.`,
      diagram: `sequenceDiagram
    participant C1 as Request A
    participant C2 as Request B
    participant C3 as Request C
    participant SCHED as Scheduler
    participant GPU as GPU Batch
    C1->>SCHED: Arrive (t=0)
    SCHED->>GPU: Batch [A]
    C2->>SCHED: Arrive (t=1)
    SCHED->>GPU: Batch [A, B]
    Note over GPU: A generates token, B generates token
    C3->>SCHED: Arrive (t=2)
    Note over GPU: A finishes (EOS)
    SCHED->>GPU: Batch [B, C]
    Note over GPU: Slot freed, C joins immediately`,
    },
    {
      title: 'Tool Use and Function Calling',
      content: `ChatGPT's tool use system allows the model to interact with external services — a key architectural extension beyond pure text generation.\n\n**Function calling protocol**: The model is trained to output structured JSON tool calls instead of text when it determines a tool would help. The orchestrator intercepts these, executes the tool, and feeds the result back to the model as a new message.\n\n**Code Interpreter**: Runs Python code in a sandboxed Jupyter-like container. Each session gets an isolated container with a mounted filesystem for uploaded files. The container has a CPU/memory limit and a network firewall (no internet access). Execution results (text, images, files) are returned to the model.\n\n**Web Browsing**: When the model issues a browse tool call, a headless browser fetches the page, extracts readable text content, and returns it to the model within the context window.\n\n**Retrieval (RAG)**: For Custom GPTs with knowledge files, uploaded documents are chunked, embedded, and stored in a vector database. When the user's query is relevant, the orchestrator retrieves the top-k chunks and injects them into the model's context.\n\n**Multi-step tool use**: The model can chain multiple tool calls in a single turn — e.g., browse a URL, then write code to analyze the data, then generate a chart.`,
    },
    {
      title: 'GPU Cluster and Model Parallelism',
      content: `GPT-4 class models have over a trillion parameters and cannot fit on a single GPU. Serving them requires distributed inference across multiple GPUs.\n\n**Tensor parallelism**: A single layer's weight matrices are split across GPUs within a server node (typically 8 H100s). Each GPU computes a portion of the matrix multiplication, and results are all-reduced. This requires high-bandwidth interconnect (NVLink at 900 GB/s).\n\n**Pipeline parallelism**: The model's layers are split across multiple nodes. Node 1 computes layers 1-N, sends activations to Node 2 for layers N+1-2N, and so on. This allows using more GPUs but adds latency proportional to the number of pipeline stages.\n\n**Cluster management**: The inference cluster runs on Kubernetes with custom GPU scheduling. Failed GPUs are automatically detected and the model shard is migrated to a healthy GPU. The cluster maintains a pool of hot spare GPUs for rapid failover.\n\n**Cost**: Running inference at ChatGPT's scale requires tens of thousands of H100 GPUs. At ~$30K per GPU, the hardware cost alone is in the hundreds of millions. Efficient utilization (measured by Model FLOPs Utilization) is critical — even a 5% improvement saves millions of dollars.`,
    },
  ],
  tradeoffs: [
    {
      decision: 'Continuous batching over static batching',
      pros: ['Much higher GPU utilization', 'Lower average latency', 'Better handling of variable-length requests'],
      cons: ['More complex scheduler implementation', 'Memory management overhead (paging)', 'Harder to guarantee consistent per-request latency'],
    },
    {
      decision: 'Server-side tool execution over client-side',
      pros: ['Model can autonomously chain tool calls', 'Consistent tool behavior across clients', 'Sandboxed execution for security'],
      cons: ['Adds latency for each tool call round-trip', 'Server cost for running sandboxed containers', 'Limited to pre-defined tool interfaces'],
    },
    {
      decision: 'Streaming token-by-token responses',
      pros: ['Perceived latency is much lower (user reads as tokens arrive)', 'Better UX for long responses', 'Client can cancel mid-generation'],
      cons: ['SSE connections consume server resources longer', 'Safety filtering must work on partial outputs', 'Client rendering complexity for streaming markdown/code'],
    },
  ],
};
