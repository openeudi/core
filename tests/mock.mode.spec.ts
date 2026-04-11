import { describe, it, expect } from 'vitest';

import { MockMode } from '../src/modes/mock.mode.js';
import type { VerificationSession, VerificationResult } from '../src/types/session.js';
import { VerificationType, VerificationStatus } from '../src/types/verification.js';

function createTestSession(overrides: Partial<VerificationSession> = {}): VerificationSession {
    return {
        id: crypto.randomUUID(),
        type: VerificationType.AGE,
        status: VerificationStatus.PENDING,
        walletUrl: 'openid4vp://verify?session=test',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 300_000),
        ...overrides,
    };
}

describe('MockMode', () => {
    it('has name "mock"', () => {
        const mode = new MockMode();
        expect(mode.name).toBe('mock');
    });

    it('returns default success result', async () => {
        const mode = new MockMode();
        const session = createTestSession();
        const result = await mode.processCallback(session, {});
        expect(result.verified).toBe(true);
        expect(result.country).toBe('DE');
        expect(result.ageVerified).toBe(true);
    });

    it('uses custom default result from config', async () => {
        const customResult: VerificationResult = {
            verified: false,
            rejectionReason: 'age_below_threshold',
        };
        const mode = new MockMode({ defaultResult: customResult });
        const session = createTestSession();
        const result = await mode.processCallback(session, {});
        expect(result.verified).toBe(false);
        expect(result.rejectionReason).toBe('age_below_threshold');
    });

    it('uses per-session override over default', async () => {
        const mode = new MockMode();
        const session = createTestSession();
        const override: VerificationResult = {
            verified: false,
            rejectionReason: 'country_blocked',
        };
        mode.setSessionResult(session.id, override);
        const result = await mode.processCallback(session, {});
        expect(result.verified).toBe(false);
        expect(result.rejectionReason).toBe('country_blocked');
    });

    it('clears per-session override', async () => {
        const mode = new MockMode();
        const session = createTestSession();
        mode.setSessionResult(session.id, { verified: false, rejectionReason: 'test' });
        mode.clearSessionResult(session.id);
        const result = await mode.processCallback(session, {});
        expect(result.verified).toBe(true);
    });

    it('respects configured delay', async () => {
        const mode = new MockMode({ delayMs: 50 });
        const session = createTestSession();
        const start = Date.now();
        await mode.processCallback(session, {});
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('simulateCompletion delegates to processCallback', async () => {
        const override: VerificationResult = { verified: false, rejectionReason: 'test' };
        const mode = new MockMode({ delayMs: 10 });
        const session = createTestSession();
        mode.setSessionResult(session.id, override);
        const result = await mode.simulateCompletion!(session);
        expect(result.verified).toBe(false);
    });
});
