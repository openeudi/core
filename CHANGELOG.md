# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-03-29

### Breaking Changes

- `VerificationSession` is now a discriminated union (`PendingSession | CompletedSession | ExpiredSession`)
- `session.result` and `session.completedAt` only exist on `CompletedSession` and `ExpiredSession` -- type-narrow by `session.status` to access them
- `VerificationStatus.SCANNED` removed
- `createSession()` now returns `PendingSession` instead of `VerificationSession`
- `IVerificationMode.processCallback` now receives `BaseSession` (was `VerificationSession`)
- EventEmitter `on`/`once`/`off`/`emit` are typed via `VerificationEvents` -- event name typos are compile errors
- Country codes validated against ISO 3166-1 alpha-2; invalid codes throw at `createSession()`
- Providing both `countryWhitelist` and `countryBlacklist` on the same session throws at `createSession()`

### Added

- `destroy()` method -- permanently tears down the service and prevents further use
- `cancelSession(id)` method -- cancels a pending session and emits `session:cancelled`
- `session:cancelled` event emitted when a session is cancelled
- `error` event emitted when a background simulation (DemoMode) fails
- `SessionNotPendingError` -- thrown by `cancelSession()` when session is not pending
- `ServiceDestroyedError` -- thrown by all public methods after `destroy()` is called
- `isValidCountryCode(code)` export -- ISO 3166-1 alpha-2 predicate
- New type exports: `BaseSession`, `PendingSession`, `CompletedSession`, `ExpiredSession`, `VerificationEvents`
- JSDoc on all public APIs including constructor, all methods, and all event signatures
- Input validation for `VerificationServiceConfig` and `CreateSessionInput`

### Fixed

- Memory leak: completed and cancelled sessions are now removed from the internal tracking set
- `walletUrl` race: URL is built before the `session:created` event fires, so listeners always see a populated `walletUrl`
- Silent errors: simulation failures in DemoMode now emit the `error` event instead of being swallowed

## [0.1.0] - 2026-04-11

### Added

- VerificationService with session lifecycle management (create, get, handleCallback, cleanupExpired)
- DemoMode - auto-completes verification with random EU citizen data
- MockMode - configurable responses for testing
- InMemorySessionStore - Map-based session storage
- IVerificationMode interface for custom verification strategies
- ISessionStore interface for custom storage backends (Redis, PostgreSQL)
- EventEmitter integration (session:created, session:verified, session:rejected, session:expired)
- QR code generation helper (optional peer dependency)
- SessionNotFoundError and SessionExpiredError classes
- Full TypeScript types with strict mode
- Dual ESM/CJS build output
- 35 unit tests with 95% code coverage
