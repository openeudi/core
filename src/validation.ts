import type { VerificationServiceConfig } from './types/config.js';
import type { CreateSessionInput } from './types/session.js';

/**
 * Complete set of ISO 3166-1 alpha-2 country codes (249 entries).
 * Used to validate country codes supplied in session inputs.
 *
 * Source: ISO 3166 Maintenance Agency
 * @see https://www.iso.org/iso-3166-country-codes.html
 */
const ISO_3166_1_ALPHA2: ReadonlySet<string> = new Set([
    'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG',
    'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB',
    'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW',
    'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM',
    'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM',
    'CG', 'CD', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ',
    'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE',
    'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF',
    'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP',
    'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN',
    'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL',
    'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR',
    'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT',
    'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ',
    'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS',
    'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI',
    'NE', 'NG', 'NU', 'NF', 'MK', 'MP', 'NO', 'OM', 'PK', 'PW',
    'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR',
    'QA', 'RE', 'RO', 'RU', 'RW', 'BL', 'SH', 'KN', 'LC', 'MF',
    'PM', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL',
    'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES',
    'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ',
    'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC',
    'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU',
    'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW',
]);

/**
 * Check whether a value is a valid ISO 3166-1 alpha-2 country code.
 *
 * The check is case-sensitive: codes must be uppercase two-letter strings
 * (e.g. `'DE'`, `'FR'`). Lowercase variants (`'de'`), three-letter codes
 * (`'DEU'`), empty strings, and unknown codes all return `false`.
 *
 * @param code - The string to validate
 * @returns `true` if `code` is a recognised ISO 3166-1 alpha-2 code
 *
 * @example
 * ```typescript
 * isValidCountryCode('DE'); // true
 * isValidCountryCode('de'); // false — must be uppercase
 * isValidCountryCode('DEU'); // false — alpha-3, not alpha-2
 * isValidCountryCode('XX'); // false — not a real country
 * ```
 */
export function isValidCountryCode(code: string): boolean {
    return ISO_3166_1_ALPHA2.has(code);
}

/**
 * Validate a {@link VerificationServiceConfig} object.
 *
 * Checks:
 * - `sessionTtlMs` must be a positive integer (if provided)
 * - `walletBaseUrl` must be a non-empty string (if provided)
 *
 * @param config - The configuration object to validate
 * @throws {Error} With a descriptive message if validation fails
 *
 * @example
 * ```typescript
 * validateConfig({ mode: demoMode, sessionTtlMs: -1 }); // throws
 * validateConfig({ mode: demoMode, sessionTtlMs: 60_000 }); // ok
 * ```
 */
export function validateConfig(config: Pick<VerificationServiceConfig, 'sessionTtlMs' | 'walletBaseUrl'>): void {
    if (config.sessionTtlMs !== undefined) {
        if (config.sessionTtlMs <= 0) {
            throw new Error(
                `sessionTtlMs must be a positive number, received: ${config.sessionTtlMs}`,
            );
        }
    }

    if (config.walletBaseUrl !== undefined) {
        if (config.walletBaseUrl.trim().length === 0) {
            throw new Error('walletBaseUrl must be a non-empty string');
        }
    }
}

/**
 * Validate a {@link CreateSessionInput} object before creating a session.
 *
 * Checks:
 * - `countryWhitelist` and `countryBlacklist` cannot both be provided
 * - All codes in `countryWhitelist` must be valid ISO 3166-1 alpha-2 codes
 * - All codes in `countryBlacklist` must be valid ISO 3166-1 alpha-2 codes
 *
 * @param input - The session creation input to validate
 * @throws {Error} With a descriptive message if validation fails
 *
 * @example
 * ```typescript
 * // Throws — cannot combine whitelist and blacklist
 * validateSessionInput({
 *     type: VerificationType.AGE,
 *     countryWhitelist: ['DE'],
 *     countryBlacklist: ['FR'],
 * });
 *
 * // Throws — 'de' is not a valid alpha-2 code
 * validateSessionInput({ type: VerificationType.AGE, countryWhitelist: ['de'] });
 * ```
 */
export function validateSessionInput(input: CreateSessionInput): void {
    if (input.countryWhitelist !== undefined && input.countryBlacklist !== undefined) {
        throw new Error(
            'countryWhitelist and countryBlacklist cannot both be provided; use one or the other',
        );
    }

    if (input.countryWhitelist !== undefined) {
        const invalid = input.countryWhitelist.filter((code) => !isValidCountryCode(code));
        if (invalid.length > 0) {
            throw new Error(
                `countryWhitelist contains invalid ISO 3166-1 alpha-2 codes: ${invalid.join(', ')}`,
            );
        }
    }

    if (input.countryBlacklist !== undefined) {
        const invalid = input.countryBlacklist.filter((code) => !isValidCountryCode(code));
        if (invalid.length > 0) {
            throw new Error(
                `countryBlacklist contains invalid ISO 3166-1 alpha-2 codes: ${invalid.join(', ')}`,
            );
        }
    }
}
