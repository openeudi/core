import { describe, it, expect } from 'vitest';

import { DemoMode } from '../src/modes/demo.mode.js';
import type { VerificationSession } from '../src/types/session.js';
import { VerificationType, VerificationStatus } from '../src/types/verification.js';

const EU_COUNTRIES = [
    'AT',
    'BE',
    'BG',
    'HR',
    'CY',
    'CZ',
    'DK',
    'EE',
    'FI',
    'FR',
    'DE',
    'GR',
    'HU',
    'IE',
    'IT',
    'LV',
    'LT',
    'LU',
    'MT',
    'NL',
    'PL',
    'PT',
    'RO',
    'SK',
    'SI',
    'ES',
    'SE',
];

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

describe('DemoMode', () => {
    it('has name "demo"', () => {
        const mode = new DemoMode();
        expect(mode.name).toBe('demo');
    });

    it('processCallback returns verified with EU country', async () => {
        const mode = new DemoMode();
        const session = createTestSession();
        const result = await mode.processCallback(session, {});
        expect(result.verified).toBe(true);
        expect(result.ageVerified).toBe(true);
        expect(EU_COUNTRIES).toContain(result.country);
    });

    it('processCallback respects countryWhitelist', async () => {
        const mode = new DemoMode();
        const session = createTestSession({ countryWhitelist: ['DE', 'FR'] });
        const result = await mode.processCallback(session, {});
        expect(['DE', 'FR']).toContain(result.country);
    });

    it('simulateCompletion resolves after delay', async () => {
        const mode = new DemoMode({ delayMs: 50 });
        const session = createTestSession();
        const start = Date.now();
        const result = await mode.simulateCompletion!(session);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(40);
        expect(result.verified).toBe(true);
    });

    it('AGE type returns ageVerified true', async () => {
        const mode = new DemoMode();
        const session = createTestSession({ type: VerificationType.AGE });
        const result = await mode.processCallback(session, {});
        expect(result.ageVerified).toBe(true);
    });

    it('COUNTRY type returns countryVerified true', async () => {
        const mode = new DemoMode();
        const session = createTestSession({ type: VerificationType.COUNTRY });
        const result = await mode.processCallback(session, {});
        expect(result.countryVerified).toBe(true);
        expect(EU_COUNTRIES).toContain(result.country);
    });

    it('BOTH type returns both ageVerified and countryVerified', async () => {
        const mode = new DemoMode();
        const session = createTestSession({ type: VerificationType.BOTH });
        const result = await mode.processCallback(session, {});
        expect(result.ageVerified).toBe(true);
        expect(result.countryVerified).toBe(true);
        expect(EU_COUNTRIES).toContain(result.country);
    });
});
