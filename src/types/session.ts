import type { VerificationType, VerificationStatus } from './verification.js';

/**
 * A verification session tracked by the service
 */
export interface VerificationSession {
    /** Unique session identifier (UUIDv4) */
    id: string;
    /** Type of verification requested */
    type: VerificationType;
    /** Current session status */
    status: VerificationStatus;
    /** URL for wallet to initiate OpenID4VP flow */
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
    /** Completion timestamp (if verified/rejected) */
    completedAt?: Date;
    /** Verification result (populated after completion) */
    result?: VerificationResult;
}

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
    /** Allowed countries (ISO 3166-1 alpha-2) */
    countryWhitelist?: string[];
    /** Blocked countries (ISO 3166-1 alpha-2) */
    countryBlacklist?: string[];
    /** Redirect URL after verification completes */
    redirectUrl?: string;
    /** Custom metadata to attach to session */
    metadata?: Record<string, unknown>;
}
