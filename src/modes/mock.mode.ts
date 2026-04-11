import type { BaseSession, VerificationResult } from '../types/session.js';

import type { IVerificationMode } from './mode.interface.js';

export interface MockModeConfig {
    /** Default result returned for all sessions (default: verified with DE) */
    defaultResult?: VerificationResult;
    /** Delay in ms before returning result (default: 0) */
    delayMs?: number;
}

const DEFAULT_RESULT: VerificationResult = {
    verified: true,
    country: 'DE',
    ageVerified: true,
    countryVerified: true,
};

/**
 * Mock mode -- configurable responses for integration testing.
 * Supports global defaults and per-session overrides.
 */
export class MockMode implements IVerificationMode {
    readonly name = 'mock';
    private defaultResult: VerificationResult;
    private delayMs: number;
    private sessionOverrides = new Map<string, VerificationResult>();

    constructor(config: MockModeConfig = {}) {
        this.defaultResult = config.defaultResult ?? { ...DEFAULT_RESULT };
        this.delayMs = config.delayMs ?? 0;
    }

    /** Set a per-session result override */
    setSessionResult(sessionId: string, result: VerificationResult): void {
        this.sessionOverrides.set(sessionId, result);
    }

    /** Clear a per-session result override */
    clearSessionResult(sessionId: string): void {
        this.sessionOverrides.delete(sessionId);
    }

    async processCallback(session: BaseSession, _walletResponse: unknown): Promise<VerificationResult> {
        if (this.delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.delayMs));
        }
        return this.sessionOverrides.get(session.id) ?? { ...this.defaultResult };
    }

    async simulateCompletion(session: BaseSession): Promise<VerificationResult> {
        return this.processCallback(session, {});
    }
}
