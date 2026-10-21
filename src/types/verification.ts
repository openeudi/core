/**
 * Type of verification to perform
 */
export enum VerificationType {
    /**
     * Verify age. The PID carries no age-over attributes; the age comes either
     * from a proof-of-age attestation (`age_over_NN` in the mdoc namespace
     * `eu.europa.ec.av.1`) or is derived from the PID birth date (`birthdate`
     * in the SD-JWT VC `urn:eudi:pid:1`, `birth_date` in the mdoc namespace
     * `eu.europa.ec.eudi.pid.1`). Which route is used is up to the mode.
     */
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
