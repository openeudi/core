/**
 * Type of verification to perform
 */
export enum VerificationType {
    /** Verify age (over_18 attribute) */
    AGE = 'AGE',
    /** Verify country of residence */
    COUNTRY = 'COUNTRY',
    /** Verify both age and country */
    BOTH = 'BOTH',
}

/**
 * Status of a verification session.
 * SCANNED has been removed — the in-flight credential exchange state
 * is an internal wallet concern, not a session lifecycle stage.
 */
export enum VerificationStatus {
    /** Session created, waiting for wallet to initiate the flow */
    PENDING = 'PENDING',
    /** Verification completed successfully */
    VERIFIED = 'VERIFIED',
    /** Verification rejected (age, country, or policy failure) */
    REJECTED = 'REJECTED',
    /** Session expired before completion */
    EXPIRED = 'EXPIRED',
}
