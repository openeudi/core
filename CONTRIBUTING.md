# Contributing to @openeudi/core

Thank you for your interest in contributing to OpenEUDI. This document explains how to get started.

## Quick Start

```bash
git clone https://github.com/openeudi/core.git
cd core
npm install
npm test        # Run tests (vitest)
npm run build   # Build (tsup)
```

## Architecture Overview

The package is a framework-agnostic EUDI Wallet verification session engine:

- **`src/verification.service.ts`** - Core VerificationService class (extends EventEmitter). Manages session lifecycle: create, get, handleCallback, cleanupExpired.
- **`src/modes/`** - Verification strategy implementations (IVerificationMode interface):
  - `demo.mode.ts` - Auto-completes with random EU data after a delay
  - `mock.mode.ts` - Returns configurable responses for testing
  - `mode.interface.ts` - Strategy interface with processCallback, simulateCompletion, buildWalletUrl
- **`src/storage/`** - Session storage (ISessionStore interface):
  - `memory.store.ts` - In-memory Map-based store (default)
  - `store.interface.ts` - Interface for custom backends (Redis, PostgreSQL, etc.)
- **`src/types/`** - TypeScript interfaces and enums (VerificationSession, VerificationResult, VerificationType, VerificationStatus)
- **`src/errors.ts`** - SessionNotFoundError, SessionExpiredError
- **`src/qr.ts`** - Optional QR code generation (peer dependency on qrcode)

## Development Workflow

1. Create a branch from `main`
2. Write tests first (TDD encouraged)
3. Implement your changes
4. Run `npm test` and `npx tsc --noEmit` before pushing
5. Open a Pull Request

## Commit Messages

We use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `chore:` - Maintenance
- `test:` - Tests
- `refactor:` - Code restructuring

## Pull Request Process

1. Fill out the PR template
2. All CI checks must pass (typecheck, test, build)
3. Maintainer will review within 1 week
4. Squash merge preferred

## Issue Labels

- `bug` - Something is broken
- `enhancement` - New feature request
- `good-first-issue` - Good for newcomers
- `help-wanted` - Community help welcome
- `documentation` - Docs improvements
- `security` - Security related

## Code Style

- Follow existing patterns in the codebase
- Strict TypeScript (`"strict": true`) - no `any`
- ESM imports with `.js` extensions
- Tests mirror source structure: `src/modes/demo.mode.ts` -> `tests/demo.mode.spec.ts`

## Developer Certificate of Origin (DCO)

By contributing, you certify that you wrote the code or have the right to submit it under the Apache 2.0 license. Sign off your commits:

```bash
git commit -s -m "feat: add feature"
```

This adds a `Signed-off-by: Your Name <your@email.com>` line to your commit message.
