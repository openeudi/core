import { EventEmitter } from 'node:events';

import { v4 as uuidv4 } from 'uuid';

import {
    SessionNotFoundError,
    SessionExpiredError,
    SessionNotPendingError,
    ServiceDestroyedError,
} from './errors.js';
import type { IVerificationMode } from './modes/mode.interface.js';
import { InMemorySessionStore } from './storage/memory.store.js';
import type { ISessionStore } from './storage/store.interface.js';
import type { VerificationServiceConfig } from './types/config.js';
import type { VerificationEvents } from './types/events.js';
import type {
    VerificationSession,
    VerificationResult,
    CreateSessionInput,
    PendingSession,
    CompletedSession,
    ExpiredSession,
} from './types/session.js';
import { VerificationStatus } from './types/verification.js';
import { validateConfig, validateSessionInput } from './validation.js';

const DEFAULT_TTL_MS = 300_000; // 5 minutes
const DEFAULT_WALLET_BASE_URL = 'openid4vp://verify';

/**
 * EUDI Wallet verification session orchestrator.
 *
 * Manages the lifecycle of verification sessions: creation, status tracking,
 * wallet callback handling, cancellation, expiration, and event emission.
 *
 * Transport-agnostic -- consumers wire events to SSE, WebSocket, polling, etc.
 *
 * @example
 * ```typescript
 * const service = new VerificationService({
 *     mode: new DemoMode({ delayMs: 2000 }),
 *     sessionTtlMs: 60_000,
 * });
 *
 * service.on('session:verified', (session, result) => {
 *     console.log('Verified:', session.id, result.country);
 * });
 *
 * const session = await service.createSession({ type: VerificationType.AGE });
 * ```
 */
export class VerificationService extends EventEmitter {
    private store: ISessionStore;
    private mode: IVerificationMode;
    private sessionTtlMs: number;
    private walletBaseUrl: string;
    /** Track session IDs for cleanup (store interface has no list method) */
    private sessionIds = new Set<string>();
    /** Whether {@link destroy} has been called */
    private destroyed = false;

    /**
     * Create a new VerificationService instance.
     *
     * @param config - Service configuration including mode, store, TTL, and wallet URL
     * @throws {Error} If config.sessionTtlMs is not positive or config.walletBaseUrl is empty
     *
     * @example
     * ```typescript
     * const service = new VerificationService({
     *     mode: new DemoMode(),
     *     store: new InMemorySessionStore(),
     *     sessionTtlMs: 300_000,
     *     walletBaseUrl: 'openid4vp://verify',
     * });
     * ```
     */
    constructor(config: VerificationServiceConfig) {
        super();
        validateConfig(config);
        this.mode = config.mode;
        this.store = config.store ?? new InMemorySessionStore();
        this.sessionTtlMs = config.sessionTtlMs ?? DEFAULT_TTL_MS;
        this.walletBaseUrl = config.walletBaseUrl ?? DEFAULT_WALLET_BASE_URL;
    }

    // -----------------------------------------------------------------------
    // Typed EventEmitter overrides
    // -----------------------------------------------------------------------

    /**
     * Register a listener for a typed event.
     *
     * @param event - Event name from {@link VerificationEvents}
     * @param listener - Callback receiving the event's typed arguments
     * @returns this (for chaining)
     */
    on<K extends keyof VerificationEvents>(
        event: K,
        listener: (...args: VerificationEvents[K]) => void,
    ): this {
        return super.on(event, listener as (...args: unknown[]) => void);
    }

    /**
     * Register a one-time listener for a typed event.
     *
     * @param event - Event name from {@link VerificationEvents}
     * @param listener - Callback receiving the event's typed arguments (called at most once)
     * @returns this (for chaining)
     */
    once<K extends keyof VerificationEvents>(
        event: K,
        listener: (...args: VerificationEvents[K]) => void,
    ): this {
        return super.once(event, listener as (...args: unknown[]) => void);
    }

    /**
     * Remove a previously registered listener for a typed event.
     *
     * @param event - Event name from {@link VerificationEvents}
     * @param listener - The exact function reference that was registered
     * @returns this (for chaining)
     */
    off<K extends keyof VerificationEvents>(
        event: K,
        listener: (...args: VerificationEvents[K]) => void,
    ): this {
        return super.off(event, listener as (...args: unknown[]) => void);
    }

    /**
     * Emit a typed event.
     *
     * @param event - Event name from {@link VerificationEvents}
     * @param args - Arguments matching the event's type signature
     * @returns true if the event had listeners, false otherwise
     */
    emit<K extends keyof VerificationEvents>(
        event: K,
        ...args: VerificationEvents[K]
    ): boolean {
        return super.emit(event, ...args);
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Create a new verification session.
     *
     * Builds the wallet URL, persists the session, emits `session:created`,
     * and (if the mode supports it) kicks off background auto-completion.
     *
     * @param input - Session creation parameters (type, country filters, metadata)
     * @returns The newly created pending session with a populated walletUrl
     * @throws {ServiceDestroyedError} If the service has been destroyed
     * @throws {Error} If input validation fails (e.g. invalid country codes)
     * @emits session:created When the session is persisted
     *
     * @example
     * ```typescript
     * const session = await service.createSession({
     *     type: VerificationType.AGE,
     *     countryWhitelist: ['DE', 'FR'],
     * });
     * console.log(session.walletUrl); // 'openid4vp://verify?session=...'
     * ```
     */
    async createSession(input: CreateSessionInput): Promise<PendingSession> {
        this.assertNotDestroyed();
        validateSessionInput(input);

        const id = uuidv4();
        const now = new Date();

        // Build walletUrl BEFORE constructing the session object so
        // the session:created event always carries a non-empty walletUrl.
        const walletUrl = this.mode.buildWalletUrl
            ? await this.mode.buildWalletUrl(id, input)
            : `${this.walletBaseUrl}?session=${id}`;

        const session: PendingSession = {
            id,
            type: input.type,
            status: VerificationStatus.PENDING,
            walletUrl,
            countryWhitelist: input.countryWhitelist,
            countryBlacklist: input.countryBlacklist,
            redirectUrl: input.redirectUrl,
            metadata: input.metadata,
            createdAt: now,
            expiresAt: new Date(now.getTime() + this.sessionTtlMs),
        };

        await this.store.set(session);
        this.sessionIds.add(id);
        this.emit('session:created', session);

        // If mode supports auto-completion (DemoMode), trigger it in background
        if (this.mode.simulateCompletion) {
            this.mode
                .simulateCompletion(session)
                .then(async (result) => {
                    // Only auto-complete if session is still pending
                    const current = await this.store.get(id);
                    if (current && current.status === VerificationStatus.PENDING) {
                        await this.completeSession(current, result);
                    }
                })
                .catch((error: unknown) => {
                    // Emit error event instead of silently swallowing
                    this.emit('error', error instanceof Error ? error : new Error(String(error)), id);
                });
        }

        return session;
    }

    /**
     * Retrieve a session by its ID.
     *
     * @param id - The session UUID to look up
     * @returns The session in its current state
     * @throws {ServiceDestroyedError} If the service has been destroyed
     * @throws {SessionNotFoundError} If no session exists with the given ID
     *
     * @example
     * ```typescript
     * const session = await service.getSession('550e8400-e29b-41d4-a716-446655440000');
     * if (session.status === VerificationStatus.VERIFIED) {
     *     console.log('Already verified:', session.result);
     * }
     * ```
     */
    async getSession(id: string): Promise<VerificationSession> {
        this.assertNotDestroyed();
        const session = await this.store.get(id);
        if (!session) {
            throw new SessionNotFoundError(id);
        }
        return session;
    }

    /**
     * Handle a callback from the wallet containing credential data.
     *
     * Delegates to the mode's `processCallback` to evaluate the wallet response,
     * then transitions the session to VERIFIED or REJECTED.
     *
     * @param sessionId - The session UUID the callback belongs to
     * @param walletResponse - Raw credential data from the wallet
     * @returns The verification result
     * @throws {ServiceDestroyedError} If the service has been destroyed
     * @throws {SessionNotFoundError} If no session exists with the given ID
     * @throws {SessionExpiredError} If the session has passed its TTL
     * @emits session:verified When verification succeeds
     * @emits session:rejected When verification fails
     *
     * @example
     * ```typescript
     * const result = await service.handleCallback(sessionId, walletData);
     * if (result.verified) {
     *     grantAccess(result.country);
     * }
     * ```
     */
    async handleCallback(sessionId: string, walletResponse: unknown): Promise<VerificationResult> {
        this.assertNotDestroyed();
        const session = await this.store.get(sessionId);
        if (!session) {
            throw new SessionNotFoundError(sessionId);
        }
        if (new Date() > session.expiresAt) {
            throw new SessionExpiredError(sessionId);
        }

        const result = await this.mode.processCallback(session, walletResponse);
        await this.completeSession(session, result);
        return result;
    }

    /**
     * Cancel a pending verification session.
     *
     * Only sessions in PENDING status can be cancelled. Completed or expired
     * sessions will cause a {@link SessionNotPendingError}.
     *
     * @param id - The session UUID to cancel
     * @throws {ServiceDestroyedError} If the service has been destroyed
     * @throws {SessionNotFoundError} If no session exists with the given ID
     * @throws {SessionNotPendingError} If the session is not in PENDING status
     * @emits session:cancelled When the session is removed
     *
     * @example
     * ```typescript
     * await service.cancelSession(session.id);
     * // session is now deleted from the store
     * ```
     */
    async cancelSession(id: string): Promise<void> {
        this.assertNotDestroyed();
        const session = await this.store.get(id);
        if (!session) {
            throw new SessionNotFoundError(id);
        }
        if (session.status !== VerificationStatus.PENDING) {
            throw new SessionNotPendingError(id, session.status);
        }

        await this.store.delete(id);
        this.sessionIds.delete(id);
        this.emit('session:cancelled', session);
    }

    /**
     * Remove expired sessions from the store.
     *
     * Iterates all tracked session IDs and transitions any pending session
     * whose TTL has elapsed to EXPIRED status before deleting it.
     *
     * @returns Number of sessions that were expired and removed
     * @throws {ServiceDestroyedError} If the service has been destroyed
     * @emits session:expired For each session that is expired
     *
     * @example
     * ```typescript
     * // Run periodically (e.g. every 60 seconds)
     * const count = await service.cleanupExpired();
     * console.log(`Cleaned up ${count} expired sessions`);
     * ```
     */
    async cleanupExpired(): Promise<number> {
        this.assertNotDestroyed();
        const now = new Date();
        let count = 0;

        for (const id of this.sessionIds) {
            const session = await this.store.get(id);
            if (!session) {
                this.sessionIds.delete(id);
                continue;
            }
            if (now > session.expiresAt && session.status === VerificationStatus.PENDING) {
                const expired: ExpiredSession = {
                    ...session,
                    status: VerificationStatus.EXPIRED,
                    completedAt: now,
                };
                await this.store.set(expired);
                await this.store.delete(id);
                this.sessionIds.delete(id);
                this.emit('session:expired', expired);
                count++;
            }
        }

        return count;
    }

    /**
     * Permanently destroy this service instance.
     *
     * Removes all event listeners, clears tracked session IDs, and marks
     * the instance as destroyed. All subsequent public method calls will
     * throw {@link ServiceDestroyedError}.
     *
     * @example
     * ```typescript
     * service.destroy();
     * // Any further call throws ServiceDestroyedError
     * await service.createSession({ type: VerificationType.AGE }); // throws
     * ```
     */
    destroy(): void {
        this.removeAllListeners();
        this.sessionIds.clear();
        this.destroyed = true;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Guard that throws if the service has been destroyed.
     * Called at the top of every public method.
     */
    private assertNotDestroyed(): void {
        if (this.destroyed) {
            throw new ServiceDestroyedError();
        }
    }

    /**
     * Transition a session to VERIFIED or REJECTED and emit the appropriate event.
     */
    private async completeSession(session: VerificationSession, result: VerificationResult): Promise<void> {
        const status = result.verified ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;
        const updated: CompletedSession = {
            ...session,
            status,
            completedAt: new Date(),
            result,
        };

        await this.store.set(updated);
        this.sessionIds.delete(session.id);

        if (result.verified) {
            this.emit('session:verified', updated, result);
        } else {
            this.emit('session:rejected', updated, result.rejectionReason ?? '');
        }
    }
}
