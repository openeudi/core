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
 * Status of a verification session
 */
export enum VerificationStatus {
    /** Session created, waiting for wallet scan */
    PENDING = 'PENDING',
    /** QR code scanned, credential exchange in progress */
    SCANNED = 'SCANNED',
    /** Verification completed successfully */
    VERIFIED = 'VERIFIED',
    /** Verification rejected (age, country, or policy) */
    REJECTED = 'REJECTED',
    /** Session expired before completion */
    EXPIRED = 'EXPIRED',
}
