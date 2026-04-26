// @openeudi/core -- EUDI Wallet verification protocol engine
export const VERSION = '0.8.0';

// Types
export { VerificationType, VerificationStatus } from './types/index.js';
export type {
    VerificationSession,
    VerificationResult,
    CreateSessionInput,
    VerificationServiceConfig,
    BaseSession,
    PendingSession,
    CompletedSession,
    ExpiredSession,
    VerificationEvents,
} from './types/index.js';

// Errors
export {
    SessionNotFoundError,
    SessionExpiredError,
    SessionNotPendingError,
    ServiceDestroyedError,
} from './errors.js';

// Storage
export type { ISessionStore } from './storage/store.interface.js';
export { InMemorySessionStore } from './storage/memory.store.js';

// Modes
export type { IVerificationMode } from './modes/mode.interface.js';
export { DemoMode } from './modes/demo.mode.js';
export type { DemoModeConfig } from './modes/demo.mode.js';
export { MockMode } from './modes/mock.mode.js';
export type { MockModeConfig } from './modes/mock.mode.js';

// Validation
export { isValidCountryCode } from './validation.js';

// Service
export { VerificationService } from './verification.service.js';
