/**
 * Thrown when a session ID is not found in the store
 */
export class SessionNotFoundError extends Error {
    constructor(sessionId: string) {
        super(`Session not found: ${sessionId}`);
        this.name = 'SessionNotFoundError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Thrown when an operation is attempted on an expired session
 */
export class SessionExpiredError extends Error {
    constructor(sessionId: string) {
        super(`Session expired: ${sessionId}`);
        this.name = 'SessionExpiredError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Thrown when an operation requires a session to be in PENDING status
 * but it is in a different status (e.g., cancelling an already-completed session).
 */
export class SessionNotPendingError extends Error {
    /** The session ID that was not in PENDING status */
    readonly sessionId: string;
    /** The status the session was actually in */
    readonly currentStatus: string;

    constructor(sessionId: string, currentStatus: string) {
        super(`Session ${sessionId} is not pending (current status: ${currentStatus})`);
        this.name = 'SessionNotPendingError';
        this.sessionId = sessionId;
        this.currentStatus = currentStatus;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Thrown when any method is called on a {@link VerificationService} instance
 * after {@link VerificationService.destroy} has been invoked.
 */
export class ServiceDestroyedError extends Error {
    constructor() {
        super('VerificationService has been destroyed and cannot accept new operations');
        this.name = 'ServiceDestroyedError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
