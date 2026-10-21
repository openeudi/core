import type { BaseSession, VerificationSession } from '../types/session.js';

/**
 * Status value written to the store while a wallet callback for the session is
 * being processed.
 *
 * It is deliberately not a member of {@link VerificationStatus}: it is a storage
 * concern only. {@link VerificationService} never returns it and never emits it;
 * `getSession` reports such a session as `PENDING`, as it did before this marker
 * existed. Only stores that implement {@link ISessionStore.compareAndSet} ever
 * receive a session with this status, so their schema has to accept it.
 *
 * If a process dies while processing a callback, the marker stays and the
 * session accepts no further callback. `cleanupExpired` does not expire it, so
 * such stores should also drop sessions on their own after `expiresAt` (for
 * example a Redis key TTL).
 */
export const PROCESSING_STATUS = 'PROCESSING' as const;

/**
 * A session claimed by a wallet callback that has not been settled yet.
 * Persisted only through {@link ISessionStore.compareAndSet}.
 */
export interface ProcessingSession extends BaseSession {
    /** Discriminant: a callback for this session is being processed */
    status: typeof PROCESSING_STATUS;
}

/** Any session shape a store can hold: a public session state or the processing marker. */
export type StoredSession = VerificationSession | ProcessingSession;

/** Any status a stored session can carry. */
export type StoredSessionStatus = StoredSession['status'];

/**
 * Pluggable session storage interface.
 * Implement this to use Redis, PostgreSQL, or any other backend.
 *
 * Only `get`, `set` and `delete` are required. The optional methods let the
 * service work correctly when several processes share one store:
 *
 * - Without {@link compareAndSet}, a session accepts exactly one wallet callback
 *   per process (an in-process lock plus a status re-check). Two service
 *   instances sharing the store can still both process a callback for the same
 *   session. Implement `compareAndSet` to make that impossible.
 * - Without {@link listExpired}, {@link VerificationService.cleanupExpired} only
 *   sees sessions created by the same service instance since it started.
 */
export interface ISessionStore {
    /** Retrieve a session by ID, or null if not found */
    get(id: string): Promise<StoredSession | null>;
    /** Store or update a session */
    set(session: VerificationSession): Promise<void>;
    /** Delete a session by ID */
    delete(id: string): Promise<void>;
    /**
     * Optional: atomically replace the session `id` with `next`, but only if the
     * stored session exists and its status is `expectedStatus`.
     *
     * Must be atomic with respect to every other `compareAndSet` call on the same
     * store, including calls from other processes (for example a Redis Lua script
     * or `UPDATE ... WHERE id = $1 AND status = $2`).
     *
     * `next` may carry {@link PROCESSING_STATUS}.
     *
     * @returns true if the session was replaced, false if it was missing or its status differed
     */
    compareAndSet?(id: string, expectedStatus: StoredSessionStatus, next: StoredSession): Promise<boolean>;
    /**
     * Optional: IDs of `PENDING` sessions whose `expiresAt` is before `now`.
     *
     * Lets {@link VerificationService.cleanupExpired} expire sessions created by
     * other service instances or before a restart.
     */
    listExpired?(now: Date): Promise<string[]>;
}
