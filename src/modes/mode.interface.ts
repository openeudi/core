import type { BaseSession, VerificationResult, CreateSessionInput } from '../types/session.js';

/**
 * Strategy interface for verification modes.
 * Implement this to create custom modes (e.g., production with real WRPAC).
 */
export interface IVerificationMode {
    /** Human-readable mode name (e.g., 'demo', 'mock', 'production') */
    readonly name: string;

    /**
     * Process a callback from a wallet (or simulated callback).
     * Called when the wallet sends credential data back.
     *
     * @param session - The current verification session (any state)
     * @param walletResponse - Raw data from the wallet (format depends on mode)
     * @returns Verification result
     */
    processCallback(session: BaseSession, walletResponse: unknown): Promise<VerificationResult>;

    /**
     * Optional: simulate automatic completion (used by DemoMode).
     * If implemented, the service calls this after session creation
     * to auto-complete verification without a real wallet.
     *
     * @param session - The session to auto-complete
     * @returns Verification result after simulated delay
     */
    simulateCompletion?(session: BaseSession): Promise<VerificationResult>;

    /**
     * Optional: build a custom wallet URL for the session.
     * Used by ProductionMode to generate proper OpenID4VP authorization requests.
     * If not implemented, the service uses a default URL format.
     *
     * @param sessionId - The session ID
     * @param input - The session creation input
     * @returns Custom wallet URL
     */
    buildWalletUrl?(sessionId: string, input: CreateSessionInput): Promise<string>;
}
