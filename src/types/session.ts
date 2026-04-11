import type { VerificationType, VerificationStatus } from './verification.js';

/**
 * Result of a completed verification
 */
export interface VerificationResult {
    /** Whether the verification passed all checks */
    verified: boolean;
    /** Detected country (ISO 3166-1 alpha-2) */
    country?: string;
    /** Whether age check passed */
    ageVerified?: boolean;
    /** Whether country check passed */
    countryVerified?: boolean;
    /** Reason for rejection (if rejected) */
    rejectionReason?: string;
}

/**
 * Input for creating a new verification session
 */
export interface CreateSessionInput {
    /** Type of verification to perform */
    type: VerificationType;
    /** Allowed countries (ISO 3166-1 alpha-2). Cannot be combined with countryBlacklist. */
    countryWhitelist?: string[];
    /** Blocked countries (ISO 3166-1 alpha-2). Cannot be combined with countryWhitelist. */
    countryBlacklist?: string[];
    /** Redirect URL after verification completes */
    redirectUrl?: string;
    /** Custom metadata to attach to session */
    metadata?: Record<string, unknown>;
}

/**
 * Fields common to all verification session states.
 * Use the discriminated union {@link VerificationSession} in most cases.
 */
export interface BaseSession {
    /** Unique session identifier (UUIDv4) */
    id: string;
    /** Type of verification requested */
    type: VerificationType;
    /** URL for the wallet to initiate the OpenID4VP flow */
    walletUrl: string;
    /** Allowed countries (ISO 3166-1 alpha-2) */
    countryWhitelist?: string[];
    /** Blocked countries (ISO 3166-1 alpha-2) */
    countryBlacklist?: string[];
    /** Redirect URL after verification completes */
    redirectUrl?: string;
    /** Custom metadata attached to session */
    metadata?: Record<string, unknown>;
    /** Session creation timestamp */
    createdAt: Date;
    /** Session expiry timestamp */
    expiresAt: Date;
}

/**
 * A session that is waiting for wallet interaction.
 * No result or completion timestamp is available.
 */
export interface PendingSession extends BaseSession {
    /** Discriminant: session is awaiting wallet scan */
    status: VerificationStatus.PENDING;
}

/**
 * A session where the wallet completed the credential exchange,
 * either successfully (VERIFIED) or with a policy failure (REJECTED).
 */
export interface CompletedSession extends BaseSession {
    /** Discriminant: session finished with a terminal verified or rejected outcome */
    status: VerificationStatus.VERIFIED | VerificationStatus.REJECTED;
    /** Full result of the credential exchange */
    result: VerificationResult;
    /** Timestamp when the session transitioned to this status */
    completedAt: Date;
}

/**
 * A session that timed out before the wallet completed the flow.
 */
export interface ExpiredSession extends BaseSession {
    /** Discriminant: session reached its TTL without completion */
    status: VerificationStatus.EXPIRED;
    /** Timestamp when expiry was detected and recorded */
    completedAt: Date;
}

/**
 * Discriminated union of all possible verification session states.
 *
 * Narrow by checking `session.status`:
 * - `PENDING`  => {@link PendingSession}
 * - `VERIFIED` | `REJECTED` => {@link CompletedSession}
 * - `EXPIRED`  => {@link ExpiredSession}
 */
export type VerificationSession = PendingSession | CompletedSession | ExpiredSession;
