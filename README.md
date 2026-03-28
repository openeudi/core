# @openeudi/core

Framework-agnostic TypeScript SDK for EUDI Wallet age and identity verification.

> **Status:** Early development. Seeking [NGI Zero Commons Fund](https://nlnet.nl/commonsfund/) support.

## What is this?

`@openeudi/core` is a lightweight, framework-agnostic verification engine for integrating [EUDI Wallet](https://commission.europa.eu/strategy-and-policy/priorities-2019-2024/europe-fit-digital-age/european-digital-identity_en) verification into any JavaScript/TypeScript application. It handles the session lifecycle for age and identity verification using the OpenID4VP protocol.

Think of it as **Express.js for wallet verification** -- the framework, not the application.

## Features

- **Framework-agnostic** -- works with Node.js, Deno, Bun, Express, Fastify, Next.js, or any runtime
- **Pluggable storage** -- bring your own session store (Redis, PostgreSQL, etc.) via `ISessionStore` interface, or use the built-in `InMemorySessionStore`
- **Strategy pattern** -- swap verification modes without changing application code:
  - `DemoMode` -- auto-completes verification in 3 seconds (demos, prototyping)
  - `MockMode` -- configurable responses for testing
  - `ProductionMode` -- real OpenID4VP wallet verification (via [`@openeudi/openid4vp`](https://github.com/openeudi/openid4vp))
- **Event-driven** -- EventEmitter-based, transport-agnostic (SSE, WebSocket, polling -- your choice)
- **QR code generation** -- optional sub-path export (`@openeudi/core/qr`)
- **Dual format** -- ships ESM + CJS with full TypeScript declarations

## Installation

```bash
npm install @openeudi/core
```

## Quick Start

```typescript
import {
  VerificationService,
  DemoMode,
  InMemorySessionStore,
  VerificationType,
} from '@openeudi/core';

const service = new VerificationService({
  mode: new DemoMode(),
  store: new InMemorySessionStore(),
  sessionTtlMs: 300_000, // 5 minutes
});

// Create a verification session
const session = await service.createSession({
  type: VerificationType.AGE,
});

// Listen for completion
service.on('verified', (result) => {
  console.log('Verification result:', result);
});

// Poll or subscribe to session status
const current = await service.getSession(session.id);
console.log('Status:', current.status);
```

## Architecture

```
VerificationService (extends EventEmitter)
├── IVerificationMode (strategy)
│   ├── DemoMode (built-in, auto-complete)
│   ├── MockMode (built-in, configurable)
│   └── ProductionMode (via @openeudi/openid4vp)
├── ISessionStore (pluggable)
│   └── InMemorySessionStore (default)
└── Session lifecycle
    ├── createSession()
    ├── getSession()
    ├── handleCallback()
    └── cleanupExpired()
```

## Verification Types

| Type | Description |
|------|-------------|
| `AGE` | Age verification (18+, 21+) |
| `COUNTRY` | Country of residence verification |
| `BOTH` | Combined age + country verification |

## Related Packages

| Package | Description |
|---------|-------------|
| [`@openeudi/openid4vp`](https://github.com/openeudi/openid4vp) | OpenID4VP credential parsing for SD-JWT VC and mDOC formats |

## Supported Credential Formats

When used with `@openeudi/openid4vp` for production verification:

- **SD-JWT VC** -- Selective Disclosure JWT (RFC 9449)
- **mDOC/mDL** -- Mobile Document / Mobile Driving License (ISO 18013-5)

## EU Coverage

Supports credential verification from all 27 EU member states, validated against national Trusted Lists maintained by the European Commission.

## Contributing

Contributions are welcome! Please open an issue to discuss your idea before submitting a pull request.

## License

[MIT](LICENSE)

## Acknowledgements

This project is applying for funding from the [NGI Zero Commons Fund](https://nlnet.nl/commonsfund/), a fund established by [NLnet](https://nlnet.nl/) with financial support from the European Commission's [Next Generation Internet](https://ngi.eu/) initiative.
