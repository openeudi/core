import type { VerificationSession } from '../types/session.js';
import { VerificationStatus } from '../types/verification.js';

import type { ISessionStore, StoredSession, StoredSessionStatus } from './store.interface.js';

/**
 * In-memory session store using a Map.
 * Suitable for development, testing, and single-process deployments.
 * Sessions are lost on process restart.
 */
export class InMemorySessionStore implements ISessionStore {
    private sessions = new Map<string, StoredSession>();

    async get(id: string): Promise<StoredSession | null> {
        return this.sessions.get(id) ?? null;
    }

    async set(session: VerificationSession): Promise<void> {
        this.sessions.set(session.id, session);
    }

    async delete(id: string): Promise<void> {
        this.sessions.delete(id);
    }

    /**
     * Atomic because the read and the write happen in the same synchronous step,
     * with no `await` in between.
     */
    async compareAndSet(id: string, expectedStatus: StoredSessionStatus, next: StoredSession): Promise<boolean> {
        const current = this.sessions.get(id);
        if (!current || current.status !== expectedStatus) {
            return false;
        }
        this.sessions.set(id, next);
        return true;
    }

    async listExpired(now: Date): Promise<string[]> {
        const ids: string[] = [];
        for (const session of this.sessions.values()) {
            if (session.status === VerificationStatus.PENDING && now > session.expiresAt) {
                ids.push(session.id);
            }
        }
        return ids;
    }
}
