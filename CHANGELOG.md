# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
