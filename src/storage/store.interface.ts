import type { VerificationSession } from '../types/session.js';

/**
 * Pluggable session storage interface.
 * Implement this to use Redis, PostgreSQL, or any other backend.
 */
export interface ISessionStore {
    /** Retrieve a session by ID, or null if not found */
    get(id: string): Promise<VerificationSession | null>;
    /** Store or update a session */
    set(session: VerificationSession): Promise<void>;
    /** Delete a session by ID */
    delete(id: string): Promise<void>;
}
