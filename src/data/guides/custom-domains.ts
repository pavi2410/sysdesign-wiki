import type { FeatureGuide } from './types';

export const customDomains: FeatureGuide = {
  slug: 'custom-domains',
  title: 'Custom Domains',
  tagline: 'Let users map their own domains to your SaaS with DNS verification and automatic TLS',
  category: 'platform',
  tags: ['custom-domains', 'DNS', 'TLS', 'SaaS', 'multi-tenant', 'CNAME'],
  problem: `SaaS platforms often need to let customers use their own domain names (e.g., docs.acme.com instead of acme.yourapp.com). This requires DNS verification to prove domain ownership, automatic TLS certificate provisioning so HTTPS works seamlessly, and a reverse proxy layer that routes incoming requests to the correct tenant. The system must handle certificate renewal, DNS propagation delays, domain conflicts, and the operational complexity of managing thousands of certificates across a fleet of edge servers.`,
  approaches: [
    {
      name: 'Wildcard Certificate + CNAME',
      description: `Issue a single wildcard certificate (*.yourapp.com) for your platform domain. Customers create a CNAME record pointing their domain to a dedicated endpoint (e.g., custom.yourapp.com). The reverse proxy inspects the Host header and routes to the correct tenant. For the customer's own domain, provision individual certificates via Let's Encrypt.`,
      pros: [
        'Simple setup for subdomain-based tenants',
        'Single wildcard cert covers all subdomains',
        'CNAME setup is familiar to most users',
      ],
      cons: [
        'Custom domains still need individual TLS certificates',
        'CNAME cannot be used at the zone apex (bare domain)',
        'DNS propagation can take hours — poor UX during setup',
      ],
    },
    {
      name: 'Automatic Certificate Provisioning with ACME',
      description: `When a customer adds a custom domain, automatically provision a TLS certificate using the **ACME protocol** (Let's Encrypt, ZeroSSL). Use HTTP-01 or DNS-01 challenges for validation. Store certificates in a centralized store and distribute to edge servers. Automate renewal 30 days before expiry.`,
      pros: [
        'Fully automated — zero manual certificate management',
        'Free certificates via Let\'s Encrypt',
        'Supports both apex domains and subdomains',
        'HTTP-01 challenge requires no DNS access from the customer',
      ],
      cons: [
        'Rate limits: Let\'s Encrypt allows 50 certs/domain/week',
        'HTTP-01 challenge requires the domain to already point to your servers',
        'Certificate provisioning takes 10-60 seconds — not instant',
        'Must handle ACME failures gracefully (DNS not propagated yet)',
      ],
    },
    {
      name: 'Managed Edge Service (Cloudflare for SaaS, AWS CloudFront)',
      description: `Delegate custom domain handling to a managed edge platform. **Cloudflare for SaaS** (Custom Hostnames API) handles DNS verification, TLS provisioning, and edge routing. Your backend just registers domains via API and the platform handles the rest.`,
      pros: [
        'Zero infrastructure to manage for TLS and edge routing',
        'Global CDN and DDoS protection included',
        'Handles certificate lifecycle automatically',
        'Supports advanced features like Orange-to-Orange (customer also on Cloudflare)',
      ],
      cons: [
        'Per-hostname pricing can be expensive at scale',
        'Vendor lock-in to the edge provider',
        'Less control over routing logic and error pages',
        'Customer DNS must point to the provider\'s network',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph Customer["Customer Setup"]
        DNS[Customer DNS<br/>CNAME → proxy.yourapp.com]
    end
    subgraph Edge["Edge / Proxy Layer"]
        LB[Load Balancer]
        RP1[Reverse Proxy 1<br/>Caddy / Nginx]
        RP2[Reverse Proxy 2<br/>Caddy / Nginx]
    end
    subgraph Platform["Platform Services"]
        DV[Domain Verification<br/>Service]
        CP[Certificate<br/>Provisioner]
        RT[Routing Table<br/>Service]
        API[Tenant API]
    end
    subgraph Storage
        CS[(Certificate Store<br/>Vault / S3)]
        DB[(Domain Registry<br/>Database)]
        CACHE[(Route Cache<br/>Redis)]
    end
    subgraph CA["Certificate Authority"]
        LE[Let's Encrypt<br/>ACME Server]
    end
    DNS -->|HTTPS| LB
    LB --> RP1 & RP2
    RP1 & RP2 --> CACHE
    RP1 & RP2 --> CS
    API --> DV
    DV --> DB
    API --> CP
    CP --> LE
    CP --> CS
    RT --> DB
    RT --> CACHE`,
  components: [
    { name: 'Domain Verification Service', description: 'Validates that the customer owns the domain they want to connect. Supports DNS-based verification (check for a TXT record with a unique token) and HTTP-based verification (check for a file at a well-known URL). Runs verification checks periodically and on-demand.' },
    { name: 'Certificate Provisioner', description: 'Automates TLS certificate issuance and renewal via the ACME protocol (Let\'s Encrypt). Handles HTTP-01 and DNS-01 challenges, stores issued certificates securely, and schedules renewals 30 days before expiry. Implements retry logic for transient ACME failures.' },
    { name: 'Reverse Proxy / Edge Router', description: 'Terminates TLS using the correct certificate for each incoming domain. Inspects the SNI (Server Name Indication) in the TLS handshake to select the certificate, then routes the request to the correct tenant backend based on the Host header. Caddy excels here with built-in ACME support.' },
    { name: 'Routing Table Service', description: 'Maintains the mapping of custom domains to tenant IDs. Populated when customers add/verify domains. Cached in Redis for sub-millisecond lookups at the proxy layer. Supports multiple domains per tenant and domain-to-path mappings.' },
    { name: 'Certificate Store', description: 'Securely stores TLS private keys and certificates. Options include HashiCorp Vault, AWS Secrets Manager, or encrypted S3. Must support fast retrieval for proxy certificate loading. Distributes certificates to all edge nodes on issuance/renewal.' },
    { name: 'Domain Management API', description: 'REST API for tenants to add, verify, and remove custom domains. Returns verification instructions (DNS records to add), tracks verification status, and triggers certificate provisioning once verified.' },
  ],
  dataModel: `erDiagram
    CUSTOM_DOMAIN {
        string domain_id PK
        string tenant_id FK
        string domain_name UK
        enum verification_status
        string verification_token
        enum certificate_status
        timestamp verified_at
        timestamp certificate_expires_at
        timestamp created_at
    }
    TLS_CERTIFICATE {
        string cert_id PK
        string domain_id FK
        string certificate_pem
        string private_key_ref
        string issuer
        timestamp issued_at
        timestamp expires_at
        boolean active
    }
    DOMAIN_ROUTE {
        string route_id PK
        string domain_id FK
        string tenant_id FK
        string target_path
        json headers
        boolean active
    }
    VERIFICATION_ATTEMPT {
        string attempt_id PK
        string domain_id FK
        enum method
        enum result
        string error_message
        timestamp attempted_at
    }
    CUSTOM_DOMAIN ||--o{ TLS_CERTIFICATE : has
    CUSTOM_DOMAIN ||--|| DOMAIN_ROUTE : maps_to
    CUSTOM_DOMAIN ||--o{ VERIFICATION_ATTEMPT : verified_by`,
  deepDive: [
    {
      title: 'DNS Verification Flow',
      content: `Before provisioning a TLS certificate, you must verify that the customer owns the domain. Two common methods:\n\n**DNS TXT Record Verification**:\n1. Generate a unique token: \`_yourapp-verify.customer.com TXT "v=yourapp1 token=abc123"\`\n2. Customer adds the TXT record to their DNS\n3. Your service periodically queries DNS for the record\n4. Once found and matched, mark domain as verified\n5. Customer then adds CNAME/A record pointing to your servers\n\n**HTTP Verification**:\n1. Generate a token and instruct customer to serve it at \`http://customer.com/.well-known/yourapp-verify\`\n2. Your service makes an HTTP request to that URL\n3. If the response contains the expected token, domain is verified\n\n**DNS propagation**: TXT records can take 1-48 hours to propagate. Poll every 5 minutes for up to 72 hours before marking verification as failed. Show propagation status to the customer using multiple DNS resolver checks (Google 8.8.8.8, Cloudflare 1.1.1.1).`,
      diagram: `sequenceDiagram
    participant U as Customer
    participant API as Platform API
    participant DNS as DNS Service
    participant CA as Let's Encrypt
    participant RP as Reverse Proxy
    U->>API: Add domain "shop.acme.com"
    API->>API: Generate verification token
    API->>U: Add TXT record: _verify.shop.acme.com
    U->>DNS: Add TXT record
    loop Every 5 minutes
        API->>DNS: Query TXT record
    end
    DNS->>API: Record found & matches
    API->>API: Mark domain verified
    API->>U: Domain verified! Add CNAME
    U->>DNS: Add CNAME → proxy.yourapp.com
    API->>CA: Request certificate (ACME)
    CA->>API: HTTP-01 challenge
    API->>CA: Challenge response
    CA->>API: Certificate issued
    API->>RP: Deploy certificate
    API->>U: Custom domain active!`,
    },
    {
      title: 'TLS Certificate Management at Scale',
      content: `Managing thousands of TLS certificates introduces operational challenges:\n\n**Issuance**: Let's Encrypt rate limits to 50 certificates per registered domain per week. If you're issuing certificates for customer.com subdomains, this is rarely a problem. But for high-volume onboarding, pre-warm by requesting certificates in advance or use multiple ACME accounts.\n\n**Storage**: Private keys must be stored securely. Use a secrets manager (Vault, AWS Secrets Manager) with encryption at rest. Never store private keys in plain text in your database.\n\n**Distribution**: When a certificate is issued or renewed, all reverse proxy instances need it. Options:\n- **Shared storage**: All proxies read from a central store (S3, Vault). Adds latency on first request.\n- **Push distribution**: Certificate provisioner pushes to all proxy instances via API. Faster but more complex.\n- **On-demand with caching**: Proxy fetches certificate on first TLS handshake for a domain, caches locally. Caddy does this natively.\n\n**Renewal**: Certificates expire in 90 days (Let's Encrypt). Schedule renewal at 60 days. Run a daily cron job to renew certificates expiring within 30 days. Alert on any certificates expiring within 7 days as a safety net.\n\n**Revocation**: When a customer removes their domain, revoke the certificate and remove it from all proxy instances. While not strictly necessary (it will expire naturally), it's good hygiene.`,
    },
    {
      title: 'Reverse Proxy Architecture',
      content: `The reverse proxy is the critical path — every request flows through it.\n\n**Caddy** is the top choice for custom domains because it has built-in ACME support, automatic HTTPS, and on-demand TLS certificate provisioning. It can request a certificate the first time a new domain hits the server.\n\n**Nginx** with Lua modules (OpenResty) or dynamic certificate loading can also work but requires more custom code.\n\n**Certificate selection**: During the TLS handshake, the client sends the domain name via SNI (Server Name Indication). The proxy uses this to select the correct certificate BEFORE the HTTP request is visible. This means certificate lookup must be fast — use an in-memory cache with the domain-to-certificate mapping.\n\n**Routing**: After TLS termination, the proxy inspects the Host header and looks up the tenant in the routing table (Redis-cached). Routes to the correct tenant backend, injecting tenant context headers (\`X-Tenant-ID\`, \`X-Custom-Domain\`).\n\n**Fallback**: If no certificate exists for a domain (new domain, not yet provisioned), serve a branded landing page explaining setup is in progress. Never show a browser certificate error.`,
    },
  ],
  realWorldExamples: [
    { system: 'Vercel', approach: 'Customers add custom domains in the dashboard. Vercel checks DNS configuration, automatically provisions Let\'s Encrypt certificates, and routes via their global edge network. Supports apex domains via A records and subdomains via CNAME.' },
    { system: 'Shopify', approach: 'Manages millions of custom domains for merchant stores. Uses a massive Nginx/OpenResty fleet with dynamic certificate loading. Certificates are provisioned via Let\'s Encrypt and stored in a distributed certificate store.' },
    { system: 'Notion', approach: 'Notion Sites allows publishing pages under custom domains. Uses Cloudflare for SaaS (Custom Hostnames) to handle DNS verification, TLS, and edge routing without managing proxy infrastructure directly.' },
    { system: 'Ghost', approach: 'Ghost(Pro) hosting supports custom domains with automatic SSL via Let\'s Encrypt. Uses Caddy as the reverse proxy with on-demand TLS, provisioning certificates automatically on first request.' },
  ],
  tradeoffs: [
    {
      decision: 'Self-managed proxy vs Cloudflare for SaaS',
      pros: ['Self-managed: full control, no per-hostname fees', 'Cloudflare: zero infrastructure, built-in CDN/DDoS protection', 'Self-managed: works with any DNS provider'],
      cons: ['Self-managed: significant operational burden at scale', 'Cloudflare: per-hostname pricing ($0.10/month/hostname at scale)', 'Self-managed: must handle certificate lifecycle, distribution, and renewal'],
    },
    {
      decision: 'HTTP-01 vs DNS-01 ACME challenge',
      pros: ['HTTP-01: no DNS access needed, works once domain points to your server', 'DNS-01: works before DNS is pointed to you, supports wildcard certs', 'HTTP-01: simpler implementation, no DNS API integration needed'],
      cons: ['HTTP-01: requires domain to already resolve to your servers', 'DNS-01: requires integration with customer\'s DNS provider API', 'DNS-01: more complex but necessary for apex domains behind CDNs'],
    },
    {
      decision: 'On-demand vs pre-provisioned certificates',
      pros: ['On-demand: no wasted certificates for unverified domains', 'Pre-provisioned: zero latency on first request', 'On-demand: scales naturally with actual usage'],
      cons: ['On-demand: first request has 10-60s delay for certificate issuance', 'Pre-provisioned: wastes resources on domains that may never receive traffic', 'On-demand: must handle ACME failures gracefully in the request path'],
    },
  ],
};
