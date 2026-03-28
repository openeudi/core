// @openeudi/core — EUDI Wallet verification protocol engine
export const VERSION = '0.1.0';

// Types
export { VerificationType, VerificationStatus } from './types/index.js';

export type {
    VerificationSession,
    VerificationResult,
    CreateSessionInput,
    VerificationServiceConfig,
} from './types/index.js';

// Storage
export type { ISessionStore } from './storage/store.interface.js';
export { InMemorySessionStore } from './storage/memory.store.js';
