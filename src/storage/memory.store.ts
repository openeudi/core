import type { VerificationSession } from '../types/session.js';
import type { ISessionStore } from './store.interface.js';

/**
 * In-memory session store using a Map.
 * Suitable for development, testing, and single-process deployments.
 * Sessions are lost on process restart.
 */
export class InMemorySessionStore implements ISessionStore {
    private sessions = new Map<string, VerificationSession>();

    async get(id: string): Promise<VerificationSession | null> {
        return this.sessions.get(id) ?? null;
    }

    async set(session: VerificationSession): Promise<void> {
        this.sessions.set(session.id, session);
    }

    async delete(id: string): Promise<void> {
        this.sessions.delete(id);
    }
}
