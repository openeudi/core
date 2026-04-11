import type { VerificationSession, VerificationResult } from '../types/session.js';
import { VerificationType } from '../types/verification.js';

import type { IVerificationMode } from './mode.interface.js';

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

export interface DemoModeConfig {
    /** Delay in ms before auto-completion (default: 3000) */
    delayMs?: number;
}

/**
 * Demo mode — auto-completes verification with randomized EU data.
 * Used for product demos and landing page previews.
 */
export class DemoMode implements IVerificationMode {
    readonly name = 'demo';
    private delayMs: number;

    constructor(config: DemoModeConfig = {}) {
        this.delayMs = config.delayMs ?? 3000;
    }

    async processCallback(session: VerificationSession, _walletResponse: unknown): Promise<VerificationResult> {
        const country = this.pickCountry(session.countryWhitelist);
        return this.buildResult(session.type, country);
    }

    async simulateCompletion(session: VerificationSession): Promise<VerificationResult> {
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
        return this.processCallback(session, {});
    }

    private pickCountry(whitelist?: string[]): string {
        const pool = whitelist && whitelist.length > 0 ? whitelist : EU_COUNTRIES;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    private buildResult(type: VerificationType, country: string): VerificationResult {
        const includeAge = type === VerificationType.AGE || type === VerificationType.BOTH;
        const includeCountry = type === VerificationType.COUNTRY || type === VerificationType.BOTH;

        return {
            verified: true,
            country,
            ageVerified: includeAge ? true : undefined,
            countryVerified: includeCountry ? true : undefined,
        };
    }
}
