# @openeudi/core

Framework-agnostic EUDI Wallet verification protocol engine.

```bash
npm install @openeudi/core
```

## Quick Start

```ts
import {
    VerificationService,
    DemoMode,
    VerificationType,
    VerificationStatus,
} from "@openeudi/core";

const service = new VerificationService({ mode: new DemoMode() });

// Typed events -- event name typos are caught at compile time
service.on("session:created", (session) => {
    console.log("Session ready:", session.walletUrl);
});
service.on("session:verified", (session, result) => {
    console.log("Verified:", result.country, "age:", result.ageVerified);
});
service.on("session:rejected", (session, reason) => {
    console.warn("Rejected:", reason);
});
service.on("error", (err, sessionId) => {
    console.error("Background error for session", sessionId, err);
});

const session = await service.createSession({ type: VerificationType.BOTH });
console.log(session.walletUrl); // openid4vp://verify?session=<uuid> (placeholder, see below)

// Teardown when done
service.destroy();
```

## Modes

### DemoMode

Auto-completes sessions with randomized EU citizen data after a configurable delay. Ideal for product demos and landing pages.

```ts
import { DemoMode } from "@openeudi/core";

const mode = new DemoMode({
    delayMs: 2000, // auto-complete after 2s (default: 3000)
});
```

### MockMode

Returns deterministic results for integration testing. Supports global defaults and per-session overrides.

```ts
import { MockMode } from "@openeudi/core";

const mode = new MockMode({
    defaultResult: { verified: true, country: "FR", ageVerified: true },
    delayMs: 100,
});

const service = new VerificationService({ mode });
const session = await service.createSession({ type: VerificationType.AGE });

// Override result for a specific session
mode.setSessionResult(session.id, {
    verified: false,
    rejectionReason: "underage",
});

// Remove override
mode.clearSessionResult(session.id);
```

## Custom Mode

Implement `IVerificationMode` to connect to a real EUDI Wallet relying party:

```ts
import type {
    IVerificationMode,
    BaseSession,
    CreateSessionInput,
    VerificationResult,
} from "@openeudi/core";

/** Whole years between an ISO `YYYY-MM-DD` birth date and today (UTC). */
function ageInYears(birthdate: string, today = new Date()): number {
    const [year, month, day] = birthdate.split("-").map(Number);
    const beforeBirthday =
        today.getUTCMonth() + 1 < month ||
        (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
    return today.getUTCFullYear() - year - (beforeBirthday ? 1 : 0);
}

class ProductionMode implements IVerificationMode {
    readonly name = "production";

    async buildWalletUrl(sessionId: string, input: CreateSessionInput): Promise<string> {
        return buildAuthorizationRequest(sessionId, input); // your OpenID4VP request (client_id, request_uri, ...)
    }

    async processCallback(
        session: BaseSession,
        walletResponse: unknown,
    ): Promise<VerificationResult> {
        // Your OpenID4VP logic. Here: a PID as SD-JWT VC (vct "urn:eudi:pid:1").
        const claims = await verifyVPToken(walletResponse);
        // The PID has no age_over_18 attribute: derive the age from `birthdate`
        // (`birth_date` in the mdoc PID, namespace eu.europa.ec.eudi.pid.1), or
        // request a proof-of-age attestation (mdoc eu.europa.ec.av.1, age_over_NN).
        const ageVerified = ageInYears(claims.birthdate) >= 18;
        return { verified: ageVerified, country: claims.address?.country, ageVerified };
    }
}
```

A mode that talks to real wallets must implement `buildWalletUrl`. Without it the
service falls back to `<walletBaseUrl>?session=<id>` (`openid4vp://verify?session=<id>`
by default). That link is a placeholder for demos and tests: it carries no `client_id`,
`request_uri` or `dcql_query`, so it is not an OpenID4VP Authorization Request.

## Custom Storage

The default `InMemorySessionStore` works for single-process deployments. Implement `ISessionStore` for Redis, PostgreSQL, etc:

```ts
import type {
    ISessionStore,
    StoredSession,
    StoredSessionStatus,
    VerificationSession,
} from "@openeudi/core";

// Replace the session only if its current status matches, in one atomic step.
const COMPARE_AND_SET = `
local current = redis.call('GET', KEYS[1])
if not current or cjson.decode(current).status ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1`;

class RedisSessionStore implements ISessionStore {
    constructor(private redis: Redis) {}

    async get(id: string): Promise<VerificationSession | null> {
        const data = await this.redis.get(`session:${id}`);
        return data ? JSON.parse(data) : null;
    }
    async set(session: VerificationSession): Promise<void> {
        const ttl = Math.max(0, session.expiresAt.getTime() - Date.now());
        await this.redis.set(`session:${session.id}`, JSON.stringify(session), "PX", ttl);
    }
    async delete(id: string): Promise<void> {
        await this.redis.del(`session:${id}`);
    }
    // Optional. Needed when several processes share the store.
    async compareAndSet(
        id: string,
        expectedStatus: StoredSessionStatus,
        next: StoredSession,
    ): Promise<boolean> {
        const ttl = Math.max(1, next.expiresAt.getTime() - Date.now());
        const replaced = await this.redis.eval(
            COMPARE_AND_SET, 1, `session:${id}`, expectedStatus, JSON.stringify(next), ttl,
        );
        return replaced === 1;
    }
}

const service = new VerificationService({
    mode: new DemoMode(),
    store: new RedisSessionStore(new Redis()),
});
```

A session accepts exactly one wallet callback: `handleCallback` claims the session
before the mode processes the response, and every other callback for it gets
`SessionNotPendingError`. Two optional store methods matter when several processes
share a store:

- `compareAndSet(id, expectedStatus, next)` makes that claim atomic across all of
  them. Without it, the one-callback guarantee holds only inside one process. While
  a callback is processed, the stored status is `PROCESSING` (exported as
  `PROCESSING_STATUS`); your schema must accept it. `getSession` still reports such a
  session as `PENDING`.
- `listExpired(now)` returns the IDs of `PENDING` sessions past `expiresAt`. Without
  it, `cleanupExpired()` only sees sessions created by the same instance since it
  started.

## Discriminated Union Types

`VerificationSession` is a discriminated union. Narrow by `session.status` to access phase-specific fields:

```ts
import {
    VerificationStatus,
    type VerificationSession,
    type PendingSession,
    type CompletedSession,
    type ExpiredSession,
} from "@openeudi/core";

function inspect(session: VerificationSession) {
    switch (session.status) {
        case VerificationStatus.PENDING:
            // session is PendingSession here
            console.log("Waiting for wallet, url:", session.walletUrl);
            break;

        case VerificationStatus.VERIFIED:
        case VerificationStatus.REJECTED:
            // session is CompletedSession here
            // .result and .completedAt are available
            console.log("Result:", session.result, "at:", session.completedAt);
            break;

        case VerificationStatus.EXPIRED:
            // session is ExpiredSession here
            console.log("Expired at:", session.completedAt);
            break;
    }
}
```

**Fields by type:**

| Field | BaseSession | PendingSession | CompletedSession | ExpiredSession |
|---|---|---|---|---|
| `id`, `type`, `status`, `walletUrl`, `createdAt`, `expiresAt` | yes | yes | yes | yes |
| `result`, `completedAt` | - | - | yes | yes |

## Events

`VerificationService` extends `EventEmitter` with fully typed events. Listener argument types are inferred from the event name -- no casting needed.

| Event | Handler Signature | Description |
| --- | --- | --- |
| `session:created` | `(session: PendingSession) => void` | Session created, wallet URL ready |
| `session:verified` | `(session: CompletedSession, result: VerificationResult) => void` | Verification passed |
| `session:rejected` | `(session: CompletedSession, reason: string) => void` | Verification rejected |
| `session:expired` | `(session: ExpiredSession) => void` | Session TTL exceeded |
| `session:cancelled` | `(session: PendingSession) => void` | Session cancelled by caller |
| `error` | `(err: Error, sessionId?: string) => void` | Background simulation error |

```ts
service.on("session:created", (session) =>
    sendSSE(session.id, { walletUrl: session.walletUrl })
);
service.on("session:verified", (session, result) =>
    sendSSE(session.id, { status: "verified", country: result.country })
);
service.on("session:rejected", (session, reason) =>
    sendSSE(session.id, { status: "rejected", reason })
);
service.on("session:expired", (session) =>
    sendSSE(session.id, { status: "expired" })
);
service.on("session:cancelled", (session) =>
    sendSSE(session.id, { status: "cancelled" })
);
service.on("error", (err, sessionId) =>
    console.error("Service error:", err.message, sessionId)
);
```

## Input Validation

`createSession()` validates inputs and throws synchronously on bad data:

- `countryWhitelist` and `countryBlacklist` are mutually exclusive
- All country codes must be valid ISO 3166-1 alpha-2 (e.g. `"DE"`, `"FR"`)
- `isValidCountryCode(code)` is exported for use in your own validation layer

```ts
import { isValidCountryCode } from "@openeudi/core";

isValidCountryCode("DE"); // true
isValidCountryCode("XX"); // false
isValidCountryCode("deu"); // false (must be 2 uppercase letters)
```

Constructor config is also validated:

- `sessionTtlMs` must be a positive integer
- `walletBaseUrl` must be a non-empty string

## Service Lifecycle

```ts
const service = new VerificationService({ mode: new DemoMode() });

// ... normal usage ...

// Teardown: removes all listeners, clears session tracking, prevents future calls
service.destroy();

// All calls after destroy() throw ServiceDestroyedError
await service.createSession({ type: VerificationType.AGE }); // throws
```

Use `destroy()` in server shutdown handlers to prevent memory leaks when hot-reloading.

## QR Code

Optional helper to generate QR code data URIs. Requires the `qrcode` peer dependency:

```bash
npm install qrcode
```

```ts
import { generateQRCode } from "@openeudi/core/qr";

const session = await service.createSession({ type: VerificationType.AGE });
const dataUri = await generateQRCode(session.walletUrl);
// => "data:image/png;base64,..."
```

## API Reference

### `VerificationService`

| Method | Returns | Description |
| --- | --- | --- |
| `constructor(config)` | `VerificationService` | Create service with mode, optional store, TTL, and wallet URL |
| `createSession(input)` | `Promise<PendingSession>` | Create a new verification session |
| `getSession(id)` | `Promise<VerificationSession>` | Retrieve session by ID (throws `SessionNotFoundError`) |
| `handleCallback(sessionId, walletResponse)` | `Promise<VerificationResult>` | Process the wallet callback; accepted once per session (throws `SessionNotFoundError`, `SessionNotPendingError`, `SessionExpiredError`) |
| `cancelSession(id)` | `Promise<void>` | Cancel a pending session (throws `SessionNotPendingError` if not pending) |
| `cleanupExpired()` | `Promise<number>` | Remove expired sessions, returns count cleaned |
| `destroy()` | `void` | Permanently destroy the service and prevent further use |

### Configuration

```ts
interface VerificationServiceConfig {
    mode: IVerificationMode; // Required -- DemoMode, MockMode, or custom
    store?: ISessionStore;   // Default: InMemorySessionStore
    sessionTtlMs?: number;   // Default: 300_000 (5 minutes)
    walletBaseUrl?: string;  // Default: 'openid4vp://verify' (placeholder link, used only without buildWalletUrl)
}
```

### Error Classes

| Class | Thrown by | Description |
| --- | --- | --- |
| `SessionNotFoundError` | `getSession`, `handleCallback`, `cancelSession` | No session with the given ID |
| `SessionExpiredError` | `handleCallback` | Session TTL has elapsed |
| `SessionNotPendingError` | `handleCallback`, `cancelSession` | Session is not in PENDING status (already completed, or a callback is being processed) |
| `ServiceDestroyedError` | All public methods | Service has been destroyed |

## Types

All types are exported from the main entry point:

```ts
import type {
    VerificationSession,    // Discriminated union (Pending | Completed | Expired)
    BaseSession,            // Common fields shared by all session states
    PendingSession,         // Status: PENDING
    CompletedSession,       // Status: VERIFIED or REJECTED (.result, .completedAt present)
    ExpiredSession,         // Status: EXPIRED (.completedAt present)
    VerificationResult,     // Outcome of a verification
    CreateSessionInput,     // Input for createSession()
    VerificationServiceConfig, // Constructor config
    VerificationEvents,     // Event map for typed EventEmitter
    IVerificationMode,      // Strategy interface for modes
    ISessionStore,          // Storage adapter interface
    StoredSession,          // What a store holds: VerificationSession | ProcessingSession
    StoredSessionStatus,    // VerificationStatus values plus 'PROCESSING'
    ProcessingSession,      // Stored while a callback is processed (compareAndSet stores only)
    DemoModeConfig,         // DemoMode constructor options
    MockModeConfig,         // MockMode constructor options
} from "@openeudi/core";

import {
    VerificationType,       // AGE | COUNTRY | BOTH
    VerificationStatus,     // PENDING | VERIFIED | REJECTED | EXPIRED
    SessionNotFoundError,
    SessionExpiredError,
    SessionNotPendingError,
    ServiceDestroyedError,
    isValidCountryCode,
    PROCESSING_STATUS,      // 'PROCESSING' (storage-only marker)
    VERSION,                // Package version string, same as package.json
} from "@openeudi/core";
```

## Migration from v0.1.x

### Discriminated union sessions

`session.result` and `session.completedAt` no longer exist on all sessions. Narrow by `session.status`:

```ts
// Before (v0.1.x)
if (session.result?.verified) { ... }

// After (v0.2.0)
if (session.status === VerificationStatus.VERIFIED) {
    // session.result is available here (TypeScript knows this)
    console.log(session.result.country);
}
```

### VerificationStatus.SCANNED removed

Remove any handling for `VerificationStatus.SCANNED` -- it no longer exists.

### IVerificationMode.processCallback signature

Custom modes must accept `BaseSession` instead of `VerificationSession`:

```ts
// Before
async processCallback(session: VerificationSession, ...): Promise<VerificationResult>

// After
async processCallback(session: BaseSession, ...): Promise<VerificationResult>
```

### createSession return type

`createSession()` now returns `Promise<PendingSession>`. This is a narrowing of the previous `Promise<VerificationSession>` and is backward-compatible in most cases, but update type annotations accordingly.

### New required error handling

Listen for the `error` event to handle DemoMode simulation failures:

```ts
service.on("error", (err, sessionId) => {
    console.error("Simulation failed:", err.message);
});
```

## License

[Apache 2.0](./LICENSE)

## Related

[eIDAS Pro](https://eidas-pro.com) -- managed verification service with WooCommerce/Shopify plugins, admin dashboard, and compliance tools built on `@openeudi/core`.

## Community integrations

Third-party projects built on this library. These are **not** maintained or audited by OpenEUDI -- evaluate them on their own merits.

- **[eudi-verify](https://github.com/eudi-verify/eudi-verify)** -- Relying-party widget and API. Its `OpenEudiEngine` runs `@openeudi/core`'s `DemoMode` behind a swappable `VerifierEngine` interface for demo verification; production OpenID4VP flows use [`@openeudi/openid4vp`](https://github.com/openeudi/openid4vp). Demo: [demo.eudi-verify.eu](https://demo.eudi-verify.eu/).

Built something on `@openeudi/core`? Open an issue and we're happy to consider listing it here.
