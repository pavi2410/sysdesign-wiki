import type { FeatureGuide } from './types';

export const pushNotifications: FeatureGuide = {
  slug: 'push-notifications',
  title: 'Push Notifications',
  tagline: 'Fan-out delivery to APNs and FCM with guarantees, batching, and user preferences',
  category: 'real-time',
  tags: ['push', 'notifications', 'APNs', 'FCM', 'fan-out', 'mobile'],
  problem: `Push notifications are the primary re-engagement channel for mobile and web apps. When an event occurs (new message, order update, price alert), the system must determine who should be notified, respect user preferences, render the notification payload, and deliver it through platform-specific gateways (Apple Push Notification service, Firebase Cloud Messaging, Web Push). At scale, this involves millions of deliveries per minute with strict latency targets, complex preference filtering, and graceful handling of token invalidation and rate limits imposed by platform providers.`,
  approaches: [
    {
      name: 'Direct Push via Platform SDKs',
      description: `Each backend service directly calls APNs/FCM APIs when an event occurs. The simplest approach — import the SDK, construct the payload, and send. Works for small-scale apps with few notification types.`,
      pros: [
        'Zero infrastructure overhead — no queues or workers',
        'Lowest latency for small volumes',
        'Easy to understand and debug',
      ],
      cons: [
        'Tight coupling between business logic and notification delivery',
        'No retry, batching, or deduplication',
        'Each service must handle token management and preference checks',
        'Fails under load — APNs/FCM rate limits are easy to hit',
      ],
    },
    {
      name: 'Queue-Based Notification Pipeline',
      description: `Events are published to a message queue (SQS, RabbitMQ, Kafka). A dedicated notification service consumes events, resolves recipients, applies preference filters, renders payloads, and dispatches to APNs/FCM via a pool of workers. Retry, batching, and rate limiting are handled within the pipeline.`,
      pros: [
        'Decoupled — any service can trigger notifications via events',
        'Built-in retry with dead-letter queues for failed deliveries',
        'Batch processing optimizes APNs/FCM API usage',
        'Centralized preference management and deduplication',
      ],
      cons: [
        'Added latency from queue processing (typically 1-5 seconds)',
        'More infrastructure to manage (queues, workers, DLQ)',
        'Must handle queue backpressure during traffic spikes',
        'Monitoring and observability are more complex',
      ],
    },
    {
      name: 'Managed Push Service',
      description: `Use a managed service like AWS SNS, OneSignal, Firebase Notifications, or Braze. These handle device registration, audience segmentation, delivery, and analytics. Your backend sends high-level notification requests and the service handles the rest.`,
      pros: [
        'Minimal infrastructure to manage',
        'Built-in analytics (delivery rates, open rates)',
        'Cross-platform support out of the box',
        'Handles token management and platform API changes',
      ],
      cons: [
        'Per-notification costs add up at high volume',
        'Less control over delivery timing and prioritization',
        'Vendor lock-in and data residency concerns',
        'Limited customization for complex routing logic',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Triggers["Event Sources"]
        SVC1[Chat Service]
        SVC2[Order Service]
        SVC3[Alert Service]
    end
    subgraph Pipeline["Notification Pipeline"]
        Q[Message Queue<br/>Kafka / SQS]
        NS[Notification Service]
        PREF[Preference Engine]
        TMPL[Template Renderer]
        BATCH[Batch Dispatcher]
    end
    subgraph Delivery["Delivery Layer"]
        APNS[APNs Gateway]
        FCM[FCM Gateway]
        WEBP[Web Push Gateway]
    end
    subgraph Storage
        DB[(User Preferences<br/>& Tokens)]
        DLQ[(Dead Letter Queue)]
        LOG[(Delivery Log)]
    end
    SVC1 & SVC2 & SVC3 --> Q
    Q --> NS
    NS --> PREF
    PREF --> DB
    NS --> TMPL
    NS --> BATCH
    BATCH --> APNS & FCM & WEBP
    BATCH --> DLQ
    BATCH --> LOG`,
  components: [
    { name: 'Notification Service', description: 'Core orchestrator that consumes events from the queue, resolves target users, checks preferences, renders notification content, and hands off to the batch dispatcher. Handles deduplication using event IDs and suppression windows.' },
    { name: 'Preference Engine', description: 'Evaluates per-user, per-channel notification preferences. Supports granular controls: mute specific conversations, quiet hours, frequency caps, and channel-level opt-out (push, email, in-app). Preferences are cached in Redis for fast lookups.' },
    { name: 'Template Renderer', description: 'Renders notification payloads from templates with variable substitution. Supports localization (i18n), platform-specific formatting (APNs alert vs FCM data message), and rich media (images, action buttons).' },
    { name: 'Batch Dispatcher', description: 'Groups notifications by platform and sends them in batches to maximize throughput. APNs supports HTTP/2 multiplexing (hundreds of concurrent streams). FCM supports batch sends of up to 500 messages. Implements per-platform rate limiting.' },
    { name: 'Token Registry', description: 'Stores device push tokens mapped to user IDs. Handles multi-device scenarios (user has 3 devices = 3 tokens). Cleans up invalid tokens when APNs/FCM returns error codes (Unregistered, InvalidRegistration).' },
    { name: 'Delivery Tracker', description: 'Logs delivery attempts, successes, and failures. Feeds into analytics dashboards showing delivery rate, open rate, and time-to-delivery metrics. Stores data for debugging individual notification delivery issues.' },
  ],
  dataModel: `erDiagram
    DEVICE_TOKEN {
        string token_id PK
        string user_id FK
        string platform
        string token
        string app_version
        boolean active
        timestamp registered_at
        timestamp last_used
    }
    NOTIFICATION_PREFERENCE {
        string user_id FK
        string channel
        boolean push_enabled
        boolean email_enabled
        string quiet_hours_start
        string quiet_hours_end
        string timezone
    }
    NOTIFICATION {
        string notification_id PK
        string user_id FK
        string event_type
        string title
        string body
        json data
        enum status
        timestamp created_at
        timestamp delivered_at
    }
    NOTIFICATION_TEMPLATE {
        string template_id PK
        string event_type
        string locale
        string title_template
        string body_template
        json default_data
    }
    DEVICE_TOKEN }o--|| NOTIFICATION : delivered_to
    NOTIFICATION_PREFERENCE ||--o{ NOTIFICATION : filters
    NOTIFICATION_TEMPLATE ||--o{ NOTIFICATION : renders`,
  deepDive: [
    {
      title: 'APNs vs FCM Protocol Differences',
      content: `**Apple Push Notification service (APNs)**:\n- Uses HTTP/2 with JWT or certificate-based authentication\n- Supports multiplexing hundreds of requests on a single connection\n- Returns device token feedback (inactive tokens) in the response\n- Payload limit: 4KB (increased from original 256 bytes)\n- Supports critical alerts, time-sensitive notifications, and notification groups\n- Token-based auth (JWT) is preferred — certificates expire annually\n\n**Firebase Cloud Messaging (FCM)**:\n- HTTP v1 API with OAuth 2.0 authentication\n- Supports topic-based and condition-based targeting\n- Data messages (handled by app) vs notification messages (handled by OS)\n- Payload limit: 4KB for notification, 4KB for data\n- Batch send API for up to 500 messages per request\n- Handles both Android and iOS (via APNs proxy)\n\n**Web Push**:\n- Uses the VAPID protocol with application server keys\n- Payload encrypted with the push subscription's public key\n- Max payload: ~4KB (varies by browser)\n- Requires a service worker to handle incoming messages`,
    },
    {
      title: 'Deduplication and Suppression',
      content: `Users hate duplicate or excessive notifications. Implement multiple layers of deduplication:\n\n**Event-level deduplication**: Use idempotency keys (event ID + user ID) to prevent the same event from generating multiple notifications. Store processed keys in Redis with a 24-hour TTL.\n\n**Collapsing**: Multiple events of the same type within a window should collapse into one notification. "You have 5 new messages from Alice" instead of 5 separate notifications. Use collapse keys (APNs \`apns-collapse-id\`, FCM \`collapse_key\`).\n\n**Frequency capping**: Limit notifications per user per time window (e.g., max 10 push notifications per hour). Track counts in Redis with sliding window counters.\n\n**Quiet hours**: Respect user-defined quiet hours. Queue notifications during quiet periods and deliver when the window opens — or discard if they're time-sensitive and expired.\n\n**Channel suppression**: If the user is actively viewing the conversation in the app (detected via WebSocket presence), suppress the push notification for that conversation.`,
    },
    {
      title: 'Handling Token Lifecycle',
      content: `Push tokens are ephemeral and must be managed carefully:\n\n**Token registration**: Clients register their push token on every app launch (tokens can change). The backend upserts the token, deactivating any previous token for the same device.\n\n**Token invalidation**: APNs and FCM return specific error codes when a token is invalid:\n- APNs: 410 Gone (unregistered), 400 BadDeviceToken\n- FCM: messaging/registration-token-not-registered\n\nOn these errors, mark the token as inactive immediately. Do NOT retry — it will never succeed.\n\n**Token rotation**: iOS may rotate tokens during OS updates or app reinstalls. Always accept the latest token from the client and deactivate old ones.\n\n**Cleanup**: Run a weekly job to remove tokens that haven't been seen (re-registered) in 60+ days. These likely belong to uninstalled apps.\n\n**Multi-device**: A user may have 2-5 active tokens (phone, tablet, watch, web). Send to ALL active tokens. The platform OS handles deduplication across devices in the same ecosystem.`,
    },
  ],
  realWorldExamples: [
    { system: 'WhatsApp', approach: 'Sends push notifications only when the recipient is offline (no active WebSocket connection). Uses APNs VoIP pushes for call notifications to wake the app instantly. Notification content is encrypted — the server sends a "you have a new message" signal, and the app decrypts locally.' },
    { system: 'Uber', approach: 'Time-critical notifications for ride matching, driver arrival, and surge pricing. Uses FCM high-priority messages for Android and APNs with interruption-level "time-sensitive" for iOS. Delivery latency target: under 2 seconds.' },
    { system: 'Instagram', approach: 'Complex preference engine with per-feature toggles (likes, comments, follows, live videos). Uses a queue-based pipeline processing billions of notifications daily. Implements aggressive deduplication — "X and 5 others liked your photo" instead of 6 separate notifications.' },
    { system: 'Slack', approach: 'Desktop and mobile push with intelligent suppression. If you\'re active on desktop (detected via WebSocket), mobile push is suppressed. Implements per-channel notification settings (all messages, mentions only, nothing) with a 2-minute delay for mobile push to allow desktop viewing.' },
  ],
  tradeoffs: [
    {
      decision: 'Immediate delivery vs batched dispatch',
      pros: ['Immediate: lowest latency, best for time-critical alerts', 'Batched: higher throughput, fewer API calls to APNs/FCM', 'Batched: enables collapsing multiple events into one notification'],
      cons: ['Immediate: higher API call volume, easier to hit rate limits', 'Batched: adds delivery latency (1-5 seconds typical)', 'Hybrid approach (immediate for critical, batched for others) adds complexity'],
    },
    {
      decision: 'FCM for all platforms vs direct APNs + FCM',
      pros: ['FCM-only: single API, simpler implementation', 'Direct: full control over platform-specific features', 'Direct: lower latency (no FCM proxy hop for iOS)'],
      cons: ['FCM-only: limited access to APNs-specific features', 'Direct: must maintain two delivery codepaths', 'FCM proxy adds ~50-100ms latency for iOS delivery'],
    },
    {
      decision: 'Server-side vs client-side notification rendering',
      pros: ['Server-side: consistent experience, centralized templates', 'Client-side: richer UI, access to local data for personalization', 'Server-side: works even if app is killed (notification messages)'],
      cons: ['Server-side: limited to platform notification UI capabilities', 'Client-side: requires app to be running (data messages)', 'Client-side: harder to ensure consistency across platforms'],
    },
  ],
};
