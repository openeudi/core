import type { BaseSession, PendingSession, CompletedSession, ExpiredSession, VerificationResult } from './session.js';

/**
 * Typed event map for {@link VerificationService}.
 *
 * Use this interface to get full type inference when listening to events:
 *
 * @example
 * ```typescript
 * const service = new VerificationService(config);
 *
 * service.on('session:verified', (session, result) => {
 *     // session: CompletedSession, result: VerificationResult
 * });
 * ```
 *
 * Each key maps to a tuple of the listener argument types, following the
 * Node.js `EventEmitter` typed-overload convention.
 */
export interface VerificationEvents {
    /**
     * Fired after a new session is persisted to the store.
     * @param session - The freshly created pending session
     */
    'session:created': [session: PendingSession];

    /**
     * Fired after the wallet successfully completes credential exchange
     * and all policy checks pass.
     * @param session - The session now carrying VERIFIED status and result
     * @param result - The full verification result
     */
    'session:verified': [session: CompletedSession, result: VerificationResult];

    /**
     * Fired after the wallet completes credential exchange but a policy
     * check fails (age, country, or custom rule).
     * @param session - The session now carrying REJECTED status
     * @param reason - Human-readable rejection reason (from result.rejectionReason)
     */
    'session:rejected': [session: CompletedSession, reason: string];

    /**
     * Fired when a pending session is detected to have passed its TTL
     * during a {@link VerificationService.cleanupExpired} sweep.
     * @param session - The session now carrying EXPIRED status
     */
    'session:expired': [session: ExpiredSession];

    /**
     * Fired when a caller explicitly cancels a pending session.
     * @param session - The session at the time of cancellation
     */
    'session:cancelled': [session: BaseSession];

    /**
     * Fired when an internal error occurs that cannot be surfaced via a
     * rejected Promise (e.g. an error inside a fire-and-forget simulation).
     * @param error - The underlying error
     * @param sessionId - Session ID if the error is session-scoped
     */
    'error': [error: Error, sessionId?: string];
}
