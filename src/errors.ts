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
