import type { IVerificationMode } from '../modes/mode.interface.js';
import type { ISessionStore } from '../storage/store.interface.js';

/**
 * Configuration for VerificationService
 */
export interface VerificationServiceConfig {
    /** Verification mode implementation (DemoMode, MockMode, or custom) */
    mode: IVerificationMode;
    /** Session storage (defaults to InMemorySessionStore) */
    store?: ISessionStore;
    /** Session time-to-live in milliseconds (default: 300_000 = 5 minutes) */
    sessionTtlMs?: number;
    /** Base URL for wallet deep links (default: 'openid4vp://') */
    walletBaseUrl?: string;
}
