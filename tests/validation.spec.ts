import { describe, it, expect } from 'vitest';

import { isValidCountryCode, validateConfig, validateSessionInput } from '../src/validation.js';
import { VerificationType } from '../src/types/verification.js';

// ---------------------------------------------------------------------------
// isValidCountryCode
// ---------------------------------------------------------------------------

describe('isValidCountryCode', () => {
    describe('valid codes', () => {
        it('accepts DE (Germany)', () => {
            expect(isValidCountryCode('DE')).toBe(true);
        });

        it('accepts FR (France)', () => {
            expect(isValidCountryCode('FR')).toBe(true);
        });

        it('accepts US (United States)', () => {
            expect(isValidCountryCode('US')).toBe(true);
        });

        it('accepts AX (Aland Islands)', () => {
            expect(isValidCountryCode('AX')).toBe(true);
        });

        it('accepts ZW (Zimbabwe — last alphabetically)', () => {
            expect(isValidCountryCode('ZW')).toBe(true);
        });
    });

    describe('invalid codes', () => {
        it('rejects XX (not a real country)', () => {
            expect(isValidCountryCode('XX')).toBe(false);
        });

        it('rejects lowercase de (case-sensitive)', () => {
            expect(isValidCountryCode('de')).toBe(false);
        });

        it('rejects DEU (alpha-3, not alpha-2)', () => {
            expect(isValidCountryCode('DEU')).toBe(false);
        });

        it('rejects empty string', () => {
            expect(isValidCountryCode('')).toBe(false);
        });

        it('rejects a single character', () => {
            expect(isValidCountryCode('D')).toBe(false);
        });

        it('rejects numeric string', () => {
            expect(isValidCountryCode('12')).toBe(false);
        });

        it('rejects mixed case (Fr)', () => {
            expect(isValidCountryCode('Fr')).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// validateConfig
// ---------------------------------------------------------------------------

describe('validateConfig', () => {
    describe('valid configurations', () => {
        it('accepts a config with a positive sessionTtlMs', () => {
            expect(() => validateConfig({ sessionTtlMs: 300_000 })).not.toThrow();
        });

        it('accepts a config with a non-empty walletBaseUrl', () => {
            expect(() => validateConfig({ walletBaseUrl: 'openid4vp://verify' })).not.toThrow();
        });

        it('accepts a config where both optional fields are absent', () => {
            expect(() => validateConfig({})).not.toThrow();
        });

        it('accepts a config with both valid fields set', () => {
            expect(() =>
                validateConfig({ sessionTtlMs: 60_000, walletBaseUrl: 'openid4vp://verify' }),
            ).not.toThrow();
        });
    });

    describe('invalid configurations', () => {
        it('throws for negative sessionTtlMs', () => {
            expect(() => validateConfig({ sessionTtlMs: -1 })).toThrow(
                'sessionTtlMs must be a positive number',
            );
        });

        it('throws for zero sessionTtlMs', () => {
            expect(() => validateConfig({ sessionTtlMs: 0 })).toThrow(
                'sessionTtlMs must be a positive number',
            );
        });

        it('throws for empty walletBaseUrl', () => {
            expect(() => validateConfig({ walletBaseUrl: '' })).toThrow(
                'walletBaseUrl must be a non-empty string',
            );
        });

        it('throws for whitespace-only walletBaseUrl', () => {
            expect(() => validateConfig({ walletBaseUrl: '   ' })).toThrow(
                'walletBaseUrl must be a non-empty string',
            );
        });
    });
});

// ---------------------------------------------------------------------------
// validateSessionInput
// ---------------------------------------------------------------------------

describe('validateSessionInput', () => {
    describe('valid inputs', () => {
        it('accepts a minimal input with only type', () => {
            expect(() =>
                validateSessionInput({ type: VerificationType.AGE }),
            ).not.toThrow();
        });

        it('accepts an input with a valid countryWhitelist', () => {
            expect(() =>
                validateSessionInput({
                    type: VerificationType.COUNTRY,
                    countryWhitelist: ['DE', 'FR', 'AT'],
                }),
            ).not.toThrow();
        });

        it('accepts an input with a valid countryBlacklist', () => {
            expect(() =>
                validateSessionInput({
                    type: VerificationType.BOTH,
                    countryBlacklist: ['US', 'GB'],
                }),
            ).not.toThrow();
        });

        it('accepts an input with metadata and redirectUrl', () => {
            expect(() =>
                validateSessionInput({
                    type: VerificationType.AGE,
                    redirectUrl: 'https://example.com/callback',
                    metadata: { orderId: 'abc-123' },
                }),
            ).not.toThrow();
        });
    });

    describe('invalid inputs', () => {
        it('throws when both whitelist and blacklist are provided', () => {
            expect(() =>
                validateSessionInput({
                    type: VerificationType.COUNTRY,
                    countryWhitelist: ['DE'],
                    countryBlacklist: ['FR'],
                }),
            ).toThrow('countryWhitelist and countryBlacklist cannot both be provided');
        });

        it('throws for an invalid code in countryWhitelist', () => {
            expect(() =>
                validateSessionInput({
                    type: VerificationType.COUNTRY,
                    countryWhitelist: ['DE', 'XX', 'FR'],
                }),
            ).toThrow('countryWhitelist contains invalid ISO 3166-1 alpha-2 codes: XX');
        });

        it('throws for multiple invalid codes in countryWhitelist', () => {
            expect(() =>
                validateSessionInput({
                    type: VerificationType.COUNTRY,
                    countryWhitelist: ['XX', 'YY', 'ZZ'],
                }),
            ).toThrow('countryWhitelist contains invalid ISO 3166-1 alpha-2 codes');
        });

        it('throws for a lowercase code in countryWhitelist', () => {
            expect(() =>
                validateSessionInput({
                    type: VerificationType.AGE,
                    countryWhitelist: ['de'],
                }),
            ).toThrow('countryWhitelist contains invalid ISO 3166-1 alpha-2 codes: de');
        });

        it('throws for an invalid code in countryBlacklist', () => {
            expect(() =>
                validateSessionInput({
                    type: VerificationType.AGE,
                    countryBlacklist: ['US', 'INVALID'],
                }),
            ).toThrow('countryBlacklist contains invalid ISO 3166-1 alpha-2 codes: INVALID');
        });

        it('throws for a lowercase code in countryBlacklist', () => {
            expect(() =>
                validateSessionInput({
                    type: VerificationType.AGE,
                    countryBlacklist: ['fr'],
                }),
            ).toThrow('countryBlacklist contains invalid ISO 3166-1 alpha-2 codes: fr');
        });
    });
});
