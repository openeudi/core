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
    /**
     * Base URL for the default wallet link (default: `'openid4vp://verify'`).
     *
     * Used only when the mode does not implement `buildWalletUrl`; the session
     * then gets `<walletBaseUrl>?session=<id>`. That link is a placeholder for
     * demos and tests, not an OpenID4VP Authorization Request (it carries no
     * `client_id`, `request_uri` or `dcql_query`), so a real wallet cannot act
     * on it. Modes that talk to real wallets must implement `buildWalletUrl`.
     */
    walletBaseUrl?: string;
}
