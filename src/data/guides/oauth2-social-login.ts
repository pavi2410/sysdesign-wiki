import type { FeatureGuide } from './types';

export const oauth2SocialLogin: FeatureGuide = {
  slug: 'oauth2-social-login',
  title: 'OAuth2 & Social Login',
  tagline: 'Authorization code flow, token refresh, and provider federation for third-party authentication',
  category: 'security',
  tags: ['OAuth2', 'authentication', 'social-login', 'OIDC', 'SSO'],
  problem: `Users hate creating new accounts. Social login ("Sign in with Google/GitHub/Apple") reduces friction by leveraging existing identity providers. OAuth 2.0 is the standard protocol enabling this — but it's a framework with many flows, grant types, and security considerations. You must implement the authorization code flow securely, handle token lifecycle (access tokens, refresh tokens, ID tokens), support multiple providers, link social accounts to existing users, and protect against attacks like CSRF, token leakage, and open redirectors.`,
  approaches: [
    {
      name: 'Authorization Code Flow with PKCE',
      description: `The recommended OAuth 2.0 flow for all clients (web, mobile, SPA). The client redirects the user to the provider's authorization endpoint. After consent, the provider redirects back with a short-lived **authorization code**. The client exchanges the code for tokens at the token endpoint. **PKCE** (Proof Key for Code Exchange) prevents authorization code interception attacks.`,
      pros: [
        'Most secure flow — tokens never exposed in browser URL',
        'PKCE protects against code interception (critical for mobile/SPA)',
        'Supports refresh tokens for long-lived sessions',
        'Works for all client types (server-side, SPA, mobile)',
      ],
      cons: [
        'More round-trips than implicit flow (code exchange step)',
        'Requires server-side component for token exchange (or PKCE for public clients)',
        'Must handle redirect URI validation carefully',
        'Each provider has slightly different implementation quirks',
      ],
    },
    {
      name: 'OpenID Connect (OIDC) Layer',
      description: `**OIDC** extends OAuth 2.0 with an identity layer. In addition to the access token, the provider returns an **ID token** (JWT) containing the user's identity claims (email, name, profile picture). Standardized across providers — reduces custom code per provider.`,
      pros: [
        'Standardized identity claims — less per-provider code',
        'ID token is a signed JWT — can be verified without calling the provider',
        'Discovery endpoint auto-configures provider settings',
        'Supports scopes like openid, profile, email for granular data access',
      ],
      cons: [
        'Not all providers fully implement OIDC (some are OAuth-only)',
        'ID token validation requires careful implementation (signature, issuer, audience, expiry)',
        'Token size can be large if many claims are included',
        'Adds complexity on top of OAuth 2.0',
      ],
    },
    {
      name: 'Managed Auth Service (Auth0, Clerk, Firebase Auth)',
      description: `Delegate authentication entirely to a managed service. The service handles OAuth flows, token management, user database, session management, and MFA. Your backend receives verified user identity via JWT or session cookie.`,
      pros: [
        'Fastest implementation — hours instead of weeks',
        'Handles all OAuth/OIDC complexity and provider quirks',
        'Built-in user management, MFA, and security features',
        'Pre-built UI components (login forms, user profile)',
      ],
      cons: [
        'Per-MAU pricing can be expensive at scale',
        'Vendor lock-in for authentication — hard to migrate',
        'Less control over the login experience and flow',
        'Data residency concerns — user data hosted by third party',
      ],
    },
  ],
  architectureDiagram: `graph TB
    subgraph User["User's Browser"]
        APP[Your App]
    end
    subgraph YourBackend["Your Backend"]
        AUTH[Auth Service]
        SESSION[Session Manager]
        LINK[Account Linker]
    end
    subgraph Providers["Identity Providers"]
        GOOGLE[Google]
        GITHUB[GitHub]
        APPLE[Apple]
    end
    subgraph Storage
        DB[(User Database)]
        TOKENS[(Token Store<br/>Encrypted)]
        SESSIONS[(Session Store<br/>Redis)]
    end
    APP -->|1. Login button click| AUTH
    AUTH -->|2. Redirect to provider| GOOGLE & GITHUB & APPLE
    GOOGLE & GITHUB & APPLE -->|3. Redirect with auth code| AUTH
    AUTH -->|4. Exchange code for tokens| GOOGLE & GITHUB & APPLE
    AUTH --> LINK
    LINK --> DB
    AUTH --> SESSION
    SESSION --> SESSIONS
    AUTH --> TOKENS`,
  components: [
    { name: 'Auth Service', description: 'Orchestrates the OAuth flow: generates authorization URLs with state/PKCE parameters, handles the callback redirect, exchanges authorization codes for tokens, and extracts user identity from the ID token or userinfo endpoint. Supports multiple providers with a unified interface.' },
    { name: 'Account Linker', description: 'Maps social provider identities to internal user accounts. Handles first-time login (create account), returning login (find existing account), and account linking (connect multiple providers to one account). Resolves conflicts when the same email exists from different providers.' },
    { name: 'Session Manager', description: 'Creates and manages application sessions after successful authentication. Issues session tokens (JWT or opaque) and stores session state in Redis. Handles session refresh, expiry, and revocation. Supports "remember me" with extended session TTL.' },
    { name: 'Token Store', description: 'Securely stores OAuth tokens (access tokens, refresh tokens) per user per provider. Tokens are encrypted at rest. Access tokens are used when your app needs to call the provider\'s API on behalf of the user (e.g., accessing Google Calendar). Refresh tokens are used to obtain new access tokens.' },
    { name: 'Provider Registry', description: 'Configuration store for each OAuth provider: client ID, client secret, authorization endpoint, token endpoint, scopes, and OIDC discovery URL. Supports dynamic provider registration for enterprise SSO (custom SAML/OIDC providers).' },
    { name: 'CSRF & State Manager', description: 'Generates and validates the OAuth state parameter to prevent CSRF attacks. Stores state tokens in Redis with short TTL (10 minutes). Validates that the state returned in the callback matches the one sent in the authorization request.' },
  ],
  dataModel: `erDiagram
    USER {
        string user_id PK
        string email
        string name
        string avatar_url
        boolean email_verified
        timestamp created_at
    }
    SOCIAL_ACCOUNT {
        string social_id PK
        string user_id FK
        string provider
        string provider_user_id
        string email
        string access_token_encrypted
        string refresh_token_encrypted
        timestamp token_expires_at
        timestamp linked_at
    }
    SESSION {
        string session_id PK
        string user_id FK
        string device_info
        string ip_address
        timestamp created_at
        timestamp expires_at
        timestamp last_active_at
    }
    OAUTH_STATE {
        string state_token PK
        string provider
        string redirect_uri
        string pkce_verifier
        timestamp created_at
        timestamp expires_at
    }
    USER ||--o{ SOCIAL_ACCOUNT : has
    USER ||--o{ SESSION : maintains`,
  deepDive: [
    {
      title: 'Authorization Code Flow Step by Step',
      content: `**Step 1 — Authorization Request**: User clicks "Sign in with Google." Your backend generates an authorization URL:\n\n\`https://accounts.google.com/o/oauth2/v2/auth?\`\n\`client_id=YOUR_CLIENT_ID&\`\n\`redirect_uri=https://yourapp.com/auth/callback&\`\n\`response_type=code&\`\n\`scope=openid email profile&\`\n\`state=RANDOM_STATE_TOKEN&\`\n\`code_challenge=SHA256_HASH&\`\n\`code_challenge_method=S256\`\n\n**Step 2 — User Consent**: Google shows a consent screen. User approves.\n\n**Step 3 — Callback**: Google redirects to your callback URL: \`https://yourapp.com/auth/callback?code=AUTH_CODE&state=RANDOM_STATE_TOKEN\`\n\n**Step 4 — Validate State**: Verify the state parameter matches what you stored. This prevents CSRF attacks.\n\n**Step 5 — Exchange Code**: POST to Google's token endpoint with the authorization code, client secret, and PKCE code verifier. Receive: access_token, refresh_token, id_token.\n\n**Step 6 — Verify ID Token**: Decode and verify the JWT ID token: check signature (using Google's public keys from JWKS endpoint), issuer, audience, expiry, and nonce.\n\n**Step 7 — Create Session**: Extract user identity from the ID token (sub, email, name). Find or create the user in your database. Create an application session and redirect to the app.`,
      diagram: `sequenceDiagram
    participant U as User
    participant A as Your App
    participant G as Google
    U->>A: Click "Sign in with Google"
    A->>A: Generate state + PKCE
    A->>U: Redirect to Google
    U->>G: Consent screen
    G->>A: Redirect with auth code + state
    A->>A: Validate state (CSRF check)
    A->>G: Exchange code for tokens
    G->>A: access_token + id_token + refresh_token
    A->>A: Verify ID token (JWT)
    A->>A: Find/create user + create session
    A->>U: Redirect to app (logged in)`,
    },
    {
      title: 'Token Security and Storage',
      content: `OAuth tokens are sensitive credentials that must be handled carefully.\n\n**Access tokens**: Short-lived (15 min - 1 hour). Used to call the provider's API on behalf of the user. Store server-side only, encrypted at rest. Never expose to the browser unless absolutely necessary.\n\n**Refresh tokens**: Long-lived (days to months). Used to obtain new access tokens without user interaction. Store server-side, encrypted, with strict access controls. Refresh token rotation: each time you use a refresh token, the provider issues a new one and invalidates the old one.\n\n**ID tokens**: JWTs containing user identity claims. Validate signature, issuer, audience, and expiry on every use. Cache the provider's JWKS (public keys) for signature verification. Do NOT use the ID token as an API access token.\n\n**Session tokens** (your app): After OAuth completes, issue your own session token. Options:\n- **HTTP-only cookie**: Most secure for web apps. Set Secure, SameSite=Lax, HttpOnly flags.\n- **JWT in Authorization header**: Better for API-first apps. Short expiry (15 min) with refresh mechanism.\n\n**Never store tokens in**: localStorage (XSS risk), URL parameters (logged in server logs/history), or unencrypted database fields.\n\n**Token revocation**: When a user disconnects a social account or your app detects suspicious activity, revoke the refresh token by calling the provider's revocation endpoint.`,
    },
    {
      title: 'Account Linking and Edge Cases',
      content: `Mapping social identities to internal accounts has subtle edge cases.\n\n**First-time login**: No matching social account or email exists. Create a new user and link the social account. Simple case.\n\n**Returning user**: Social account already linked. Find the user by (provider, provider_user_id). Log them in.\n\n**Email collision**: User signs up with Google (alice@example.com), later tries to log in with GitHub (also alice@example.com). Options:\n- **Auto-link by email**: If the email is verified by both providers, assume same person and link. Convenient but risky if one provider doesn't verify emails.\n- **Prompt to link**: Show "An account with this email already exists. Log in with Google to link your GitHub account." Safer but more friction.\n- **Separate accounts**: Create a new account. Safest but can confuse users.\n\n**Multiple providers**: A user may link Google, GitHub, and Apple to one account. Store all social accounts and allow login via any of them. The user should be able to see and manage linked providers in their settings.\n\n**Provider-specific quirks**:\n- **Apple**: Uses "private relay" emails (randomhash@privaterelay.appleid.com). Store the real email from the first authentication — Apple only sends it once.\n- **GitHub**: Email may be private. Requires additional API call to /user/emails endpoint.\n- **Google**: Always returns verified email. Most reliable provider for email-based linking.`,
    },
  ],
  realWorldExamples: [
    { system: 'GitHub', approach: 'OAuth provider and consumer. As a consumer, supports Google, SAML, and LDAP login for Enterprise. As a provider, one of the most commonly integrated OAuth providers for developer tools. Uses authorization code flow with scopes like repo, user, admin:org.' },
    { system: 'Clerk', approach: 'Managed authentication service handling OAuth/OIDC flows for 20+ providers. Pre-built UI components (sign-in, user profile). Handles account linking, MFA, and organization management. SDKs for React, Next.js, and more.' },
    { system: 'Discord', approach: 'OAuth2 provider for bot authorizations and third-party app integrations. Implements authorization code flow with bot and webhook scopes. Rich permission system for OAuth applications accessing guilds and channels.' },
    { system: 'Auth0', approach: 'Universal login platform supporting 30+ social providers, enterprise SAML/LDAP, and passwordless authentication. Uses "Rules" and "Actions" for custom post-authentication logic. Token exchange and federation between multiple identity providers.' },
  ],
  tradeoffs: [
    {
      decision: 'Build custom OAuth vs use managed service (Auth0, Clerk)',
      pros: ['Custom: full control, no per-user cost, data stays internal', 'Managed: weeks faster to implement, handles edge cases', 'Managed: built-in MFA, password reset, account recovery'],
      cons: ['Custom: significant effort (2-4 weeks for solid implementation)', 'Managed: per-MAU pricing, vendor lock-in', 'Custom: must handle security updates and provider API changes yourself'],
    },
    {
      decision: 'Auto-link by email vs prompt to link accounts',
      pros: ['Auto-link: seamless UX, no extra steps for the user', 'Prompt: prevents account takeover via unverified emails', 'Auto-link: safe if you only link verified emails from trusted providers'],
      cons: ['Auto-link: security risk if a provider doesn\'t verify emails', 'Prompt: adds friction, users may create duplicate accounts', 'Auto-link: can\'t distinguish between same person and email collision'],
    },
    {
      decision: 'JWT session tokens vs opaque session tokens',
      pros: ['JWT: stateless verification, no database lookup per request', 'Opaque: instant revocation (delete from Redis), smaller token size', 'JWT: works well for microservices (each service can verify independently)'],
      cons: ['JWT: can\'t revoke until expiry (need a blocklist for immediate revocation)', 'Opaque: requires a centralized session store (Redis), added latency', 'JWT: token size grows with claims, risk of sensitive data in token'],
    },
  ],
};
