import type { FeatureGuide } from './types';

export const jobQueues: FeatureGuide = {
  slug: 'job-queues',
  title: 'Job Queues & Background Workers',
  tagline: 'Async task processing with retries, dead-letter queues, and priority scheduling',
  category: 'reliability',
  tags: ['queues', 'background-jobs', 'async', 'workers', 'retry'],
  problem: `Many operations are too slow or unreliable to execute during a user's HTTP request — sending emails, processing images, generating reports, syncing data with third-party APIs, or running ML inference. Job queues decouple the request from the work: the API enqueues a job and responds immediately, while background workers process the job asynchronously. The challenge is ensuring jobs are processed reliably (at-least-once delivery), handling failures with intelligent retries, scaling workers independently, prioritizing urgent jobs, and monitoring the health of the entire pipeline.`,
  approaches: [
    {
      name: 'Redis-Based Queue (BullMQ, Sidekiq)',
      description: `Use Redis as the job queue backend. Libraries like **BullMQ** (Node.js), **Sidekiq** (Ruby), or **Celery** (Python with Redis broker) provide job scheduling, retries, priority queues, and dashboards. Redis's speed makes this ideal for high-throughput, low-latency job processing.`,
      pros: [
        'Very fast enqueue/dequeue — Redis is in-memory',
        'Rich ecosystem — BullMQ, Sidekiq, Celery have mature features',
        'Built-in delayed jobs, rate limiting, and priority queues',
        'Easy to set up — Redis is already in most stacks',
      ],
      cons: [
        'Redis memory is expensive — not ideal for millions of queued jobs',
        'Durability risk — Redis can lose data on crash (mitigated with AOF)',
        'Scaling beyond single Redis instance requires Redis Cluster',
        'Not suitable for very long-running jobs (hours+)',
      ],
    },
    {
      name: 'Message Broker (RabbitMQ, SQS)',
      description: `Use a dedicated message broker. **RabbitMQ** provides AMQP-based messaging with flexible routing, while **AWS SQS** offers a fully managed queue service. Better durability guarantees than Redis and purpose-built for reliable message delivery.`,
      pros: [
        'Purpose-built for reliable message delivery',
        'Better durability — messages persisted to disk',
        'SQS: fully managed, scales automatically, pay-per-message',
        'RabbitMQ: flexible routing, exchanges, dead-letter queues',
      ],
      cons: [
        'Higher latency than Redis-based queues',
        'RabbitMQ: operational complexity (clustering, monitoring)',
        'SQS: limited features (no priority queues, FIFO limited to 300 msg/s)',
        'More infrastructure to manage (vs Redis you already have)',
      ],
    },
    {
      name: 'Event Streaming (Kafka)',
      description: `Use **Kafka** as a durable, ordered log. Producers publish job events to topics, consumer groups process them. Kafka excels at high-throughput ordered processing but is heavier than needed for simple job queues.`,
      pros: [
        'Extreme throughput — millions of messages per second',
        'Durable — replicated, persisted log with configurable retention',
        'Ordered processing per partition',
        'Replay capability — reprocess failed jobs from any offset',
      ],
      cons: [
        'Overkill for simple job queues — complex to operate',
        'No built-in delayed jobs, retries, or priority queues',
        'Consumer group rebalancing causes processing pauses',
        'Higher latency for individual job processing',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Producers["Job Producers"]
        API[API Server]
        CRON[Cron Scheduler]
        HOOK[Webhook Handler]
    end
    subgraph Queue["Queue Layer"]
        PQ[Priority Queue<br/>Critical Jobs]
        NQ[Normal Queue<br/>Standard Jobs]
        DQ[Delayed Queue<br/>Scheduled Jobs]
        DLQ[Dead Letter Queue<br/>Failed Jobs]
    end
    subgraph Workers["Worker Fleet"]
        W1[Worker 1<br/>Image Processing]
        W2[Worker 2<br/>Email Sending]
        W3[Worker 3<br/>General Purpose]
    end
    subgraph Storage
        REDIS[(Redis<br/>Queue Backend)]
        DB[(Database<br/>Job Results)]
        LOG[(Job Logs)]
    end
    subgraph Monitoring
        DASH[Dashboard<br/>Queue Metrics]
        ALERT[Alerting]
    end
    API & CRON & HOOK --> PQ & NQ & DQ
    PQ & NQ & DQ --> REDIS
    REDIS --> W1 & W2 & W3
    W1 & W2 & W3 --> DB
    W1 & W2 & W3 -->|Failed after retries| DLQ
    W1 & W2 & W3 --> LOG
    REDIS --> DASH
    DASH --> ALERT`,
  components: [
    { name: 'Job Producer', description: 'Any service that creates jobs. Enqueues a job with a type, payload, priority, and optional delay/schedule. Must generate an idempotent job ID to prevent duplicate processing. Should set a reasonable TTL so stale jobs don\'t execute hours later.' },
    { name: 'Queue Manager', description: 'Manages multiple named queues with different priorities and processing characteristics. Routes jobs to the appropriate queue based on type. Handles delayed jobs (schedule for future execution) and recurring jobs (cron-like schedules).' },
    { name: 'Worker Pool', description: 'Fleet of worker processes that consume jobs from queues. Each worker pulls a job, processes it, and acknowledges completion. Supports concurrency limits per worker (process N jobs simultaneously). Can be specialized (image worker, email worker) or general-purpose.' },
    { name: 'Retry Manager', description: 'Handles job failures with configurable retry strategies: fixed delay, exponential backoff with jitter, or custom backoff functions. Tracks attempt count per job. After max retries, moves the job to the dead-letter queue for manual investigation.' },
    { name: 'Dead Letter Queue', description: 'Holds jobs that failed after all retry attempts. Provides a UI for inspecting failed job payloads, error messages, and stack traces. Supports manual retry (re-enqueue individual or batch) and permanent discard. Critical for debugging production issues.' },
    { name: 'Job Dashboard', description: 'Real-time visibility into queue health: pending count, processing rate, failure rate, average processing time, and worker utilization. BullMQ has Bull Board, Sidekiq has a built-in web UI. Alerts when queue depth exceeds thresholds.' },
  ],
  dataModel: `erDiagram
    JOB {
        string job_id PK
        string queue_name
        string type
        json payload
        enum status
        int priority
        int attempt
        int max_attempts
        string error_message
        timestamp scheduled_at
        timestamp started_at
        timestamp completed_at
        timestamp created_at
    }
    JOB_RESULT {
        string job_id FK
        json result
        int duration_ms
        timestamp completed_at
    }
    QUEUE_CONFIG {
        string queue_name PK
        int concurrency
        int max_retries
        string backoff_strategy
        int rate_limit_per_second
        boolean paused
    }
    RECURRING_JOB {
        string schedule_id PK
        string queue_name
        string type
        json payload
        string cron_expression
        timestamp next_run_at
        boolean enabled
    }
    JOB ||--o| JOB_RESULT : produces
    QUEUE_CONFIG ||--o{ JOB : contains
    QUEUE_CONFIG ||--o{ RECURRING_JOB : schedules`,
  deepDive: [
    {
      title: 'Retry Strategies and Backoff',
      content: `Job failures are inevitable — network timeouts, rate limits, temporary outages. The retry strategy determines recovery speed and system impact.\n\n**Fixed interval**: Retry every 30 seconds. Simple but can cause synchronized retries (thundering herd) if many jobs fail simultaneously.\n\n**Exponential backoff**: 1s, 2s, 4s, 8s, 16s, ... Spreads retries over time. Add **jitter** (random 0-50% of the delay) to prevent synchronized retries: \`delay = min(base * 2^attempt + random(0, base * 2^attempt * 0.5), max_delay)\`\n\n**Custom backoff**: Different error types warrant different strategies:\n- Rate limited (429): Use the Retry-After header from the response\n- Network error: Exponential backoff (transient failure)\n- Validation error (400): Don't retry — move to DLQ immediately\n- Internal error (500): Retry with exponential backoff\n\n**Max attempts**: Typically 3-5 retries for API calls, 10+ for critical jobs. After max attempts, move to the dead-letter queue. Always cap the maximum delay (e.g., 1 hour) to prevent infinite backoff.\n\n**Idempotency**: Since jobs may be processed more than once (at-least-once delivery), the job handler must be idempotent. Use unique job IDs and check for prior completion before executing side effects (sending emails, charging cards).`,
    },
    {
      title: 'Scaling Workers',
      content: `Worker scaling depends on the job type and processing characteristics.\n\n**CPU-bound jobs** (image processing, PDF generation, ML inference): Scale by adding more worker processes/containers. Each worker runs one job at a time. Use container orchestration (Kubernetes HPA) to autoscale based on CPU utilization.\n\n**I/O-bound jobs** (API calls, email sending, database writes): Increase concurrency per worker. A single Node.js worker with BullMQ can process 10-50 concurrent I/O-bound jobs. Scale based on queue depth rather than CPU.\n\n**Autoscaling formula**: Target = ⌈queue_depth / (processing_rate × target_drain_time)⌉. If you have 10,000 pending jobs, each worker processes 100 jobs/minute, and you want to drain in 10 minutes: Target = ⌈10,000 / (100 × 10)⌉ = 10 workers.\n\n**Queue-based autoscaling**: Monitor queue depth and processing latency. Scale up when queue depth exceeds threshold or processing latency exceeds SLA. Scale down when queues are empty. Use a cooldown period to avoid thrashing.\n\n**Graceful shutdown**: When scaling down or deploying, workers must finish their current job before terminating. Implement SIGTERM handling: stop accepting new jobs, wait for in-progress jobs to complete (with a timeout), then exit. Kubernetes provides a terminationGracePeriodSeconds for this.`,
    },
    {
      title: 'Job Scheduling and Cron',
      content: `Beyond on-demand jobs, many systems need scheduled and recurring jobs.\n\n**Delayed jobs**: Enqueue a job to be processed at a specific future time. Use case: "Send a follow-up email 24 hours after signup." BullMQ and Sidekiq support this natively with a delay parameter.\n\n**Recurring jobs (cron)**: Jobs that run on a schedule — daily reports, hourly data sync, weekly cleanup. Implementation options:\n- **In-queue scheduling**: BullMQ's \`repeat\` option creates jobs on a cron schedule. The queue library manages the schedule.\n- **External scheduler**: A cron service (node-cron, Kubernetes CronJobs) enqueues jobs at the scheduled time. Simpler but requires a separate scheduler process.\n\n**Distributed cron**: In a multi-instance deployment, you must ensure the cron job is triggered exactly once, not once per instance. Solutions:\n- Use a distributed lock (Redis SETNX with TTL) before enqueuing\n- Use a single scheduler instance (leader election)\n- Use BullMQ's built-in repeat — it handles deduplication automatically\n\n**Missed schedules**: If the scheduler is down when a job should run, should it catch up? BullMQ skips missed runs by default. For critical jobs (daily billing), implement catch-up logic that checks the last run time on startup and enqueues missed jobs.`,
    },
  ],
  realWorldExamples: [
    { system: 'GitHub', approach: 'Uses a custom job queue system for CI/CD (Actions), webhook delivery, and background processing. Jobs are distributed across thousands of workers. Implements priority queues for paid accounts and complex retry logic for webhook delivery.' },
    { system: 'Shopify', approach: 'Processes billions of background jobs daily using a custom job framework built on Redis. Handles order processing, inventory updates, email sending, and storefront pre-rendering. Workers are autoscaled based on queue depth across multiple data centers.' },
    { system: 'Stripe', approach: 'Event-driven architecture where payment events trigger chains of background jobs (send receipt, update ledger, trigger webhooks). Uses idempotency keys to ensure jobs are processed exactly once even with retries.' },
    { system: 'Vercel', approach: 'Uses job queues for build processing and deployment. Each build is a job with resource limits and timeouts. Implements fair scheduling across customers to prevent one user\'s builds from starving others.' },
  ],
  tradeoffs: [
    {
      decision: 'Redis-based (BullMQ) vs managed service (SQS)',
      pros: ['Redis: fastest enqueue/dequeue, rich features (priority, delay, rate limit)', 'SQS: fully managed, scales to any volume, pay-per-message', 'Redis: familiar if already in your stack, great dashboard (Bull Board)'],
      cons: ['Redis: memory-bound, durability concerns without AOF', 'SQS: limited features (no native priority, max 14-day retention)', 'SQS: higher per-message cost at very high volumes'],
    },
    {
      decision: 'At-least-once vs exactly-once processing',
      pros: ['At-least-once: simpler, most queue systems provide this by default', 'Exactly-once: no duplicate side effects (critical for payments)', 'At-least-once with idempotent handlers: practical compromise'],
      cons: ['At-least-once: duplicate processing if worker crashes after processing but before ack', 'Exactly-once: very complex, requires distributed transactions', 'Idempotent handlers: more development effort per job type'],
    },
    {
      decision: 'Specialized vs general-purpose workers',
      pros: ['Specialized: optimized resource allocation (GPU for ML, high-memory for image)', 'General-purpose: simpler deployment, all workers handle all jobs', 'Specialized: can scale each job type independently'],
      cons: ['Specialized: more deployment complexity, potential underutilization', 'General-purpose: one job type can starve others', 'Specialized: must maintain routing logic for job → worker type'],
    },
  ],
};
