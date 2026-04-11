# @openeudi/core

Framework-agnostic EUDI Wallet verification protocol engine.

```bash
npm install @openeudi/core
```

## Quick Start

```ts
import { VerificationService, DemoMode, VerificationType } from "@openeudi/core";

const service = new VerificationService({ mode: new DemoMode() });

service.on("session:verified", (session, result) => {
  console.log(`Verified: ${result.country}, age: ${result.ageVerified}`);
});

const session = await service.createSession({ type: VerificationType.BOTH });
console.log(session.walletUrl); // openid4vp://verify?session=<uuid>
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

// Clean up override
mode.clearSessionResult(session.id);
```

## Custom Mode

Implement `IVerificationMode` to connect to a real EUDI Wallet relying party:

```ts
import type { IVerificationMode, VerificationSession, VerificationResult } from "@openeudi/core";

class ProductionMode implements IVerificationMode {
  readonly name = "production";

  async processCallback(session: VerificationSession, walletResponse: unknown): Promise<VerificationResult> {
    const claims = await verifyVPToken(walletResponse); // your OpenID4VP logic
    return { verified: true, country: claims.country, ageVerified: claims.age >= 18 };
  }
}
```

## Custom Storage

The default `InMemorySessionStore` works for single-process deployments. Implement `ISessionStore` for Redis, PostgreSQL, etc:

```ts
import type { ISessionStore, VerificationSession } from "@openeudi/core";

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
}

const service = new VerificationService({
  mode: new DemoMode(),
  store: new RedisSessionStore(new Redis()),
});
```

## Events

`VerificationService` extends `EventEmitter`. Subscribe to lifecycle events:

| Event              | Handler Signature                                                    | Description                    |
| ------------------ | -------------------------------------------------------------------- | ------------------------------ |
| `session:created`  | `(session: VerificationSession) => void`                             | Session created, QR code ready |
| `session:verified` | `(session: VerificationSession, result: VerificationResult) => void` | Verification passed            |
| `session:rejected` | `(session: VerificationSession, reason?: string) => void`            | Verification rejected          |
| `session:expired`  | `(session: VerificationSession) => void`                             | Session TTL exceeded           |

```ts
service.on("session:created", (session) => sendSSE(session.id, { walletUrl: session.walletUrl }));
service.on("session:verified", (session, result) =>
  sendSSE(session.id, { status: "verified", country: result.country })
);
service.on("session:rejected", (session, reason) => sendSSE(session.id, { status: "rejected", reason }));
service.on("session:expired", (session) => sendSSE(session.id, { status: "expired" }));
```

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

| Method                                      | Returns                        | Description                                                                    |
| ------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| `constructor(config)`                       | `VerificationService`          | Create service with mode, optional store and TTL                               |
| `createSession(input)`                      | `Promise<VerificationSession>` | Create a new verification session                                              |
| `getSession(id)`                            | `Promise<VerificationSession>` | Retrieve session by ID (throws `SessionNotFoundError`)                         |
| `handleCallback(sessionId, walletResponse)` | `Promise<VerificationResult>`  | Process wallet callback (throws `SessionNotFoundError`, `SessionExpiredError`) |
| `cleanupExpired()`                          | `Promise<number>`              | Remove expired sessions, returns count cleaned                                 |

### Configuration

```ts
interface VerificationServiceConfig {
  mode: IVerificationMode; // Required — DemoMode, MockMode, or custom
  store?: ISessionStore; // Default: InMemorySessionStore
  sessionTtlMs?: number; // Default: 300_000 (5 minutes)
  walletBaseUrl?: string; // Default: 'openid4vp://verify'
}
```

## Types

All types are exported from the main entry point:

```ts
import type {
  VerificationSession, // Full session object
  VerificationResult, // Outcome of a verification
  CreateSessionInput, // Input for createSession()
  VerificationServiceConfig, // Constructor config
  IVerificationMode, // Strategy interface for modes
  ISessionStore, // Storage adapter interface
  DemoModeConfig, // DemoMode constructor options
  MockModeConfig, // MockMode constructor options
} from "@openeudi/core";

import {
  VerificationType, // AGE | COUNTRY | BOTH
  VerificationStatus, // PENDING | SCANNED | VERIFIED | REJECTED | EXPIRED
  SessionNotFoundError, // Thrown by getSession / handleCallback
  SessionExpiredError, // Thrown by handleCallback
} from "@openeudi/core";
```

## License

[Apache 2.0](./LICENSE)

## Related

[eIDAS Pro](https://eidas-pro.eu) -- managed verification service with WooCommerce/Shopify plugins, admin dashboard, and compliance tools built on `@openeudi/core`.
