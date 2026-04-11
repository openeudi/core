import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
    SessionNotFoundError,
    SessionExpiredError,
    SessionNotPendingError,
    ServiceDestroyedError,
} from '../src/errors.js';
import { DemoMode } from '../src/modes/demo.mode.js';
import type { IVerificationMode } from '../src/modes/mode.interface.js';
import { InMemorySessionStore } from '../src/storage/memory.store.js';
import type { BaseSession, VerificationResult, PendingSession, CompletedSession, ExpiredSession } from '../src/types/session.js';
import { VerificationType, VerificationStatus } from '../src/types/verification.js';
import { VerificationService } from '../src/verification.service.js';

/**
 * Creates a mode without simulateCompletion, so no background auto-completion
 * races with explicit handleCallback or cleanupExpired calls.
 */
function createNoSimulateMode(result: VerificationResult): IVerificationMode {
    return {
        name: 'test-no-simulate',
        async processCallback() {
            return result;
        },
    };
}

/**
 * Creates a mode whose simulateCompletion always throws.
 */
function createThrowingSimulateMode(): IVerificationMode {
    return {
        name: 'test-throwing-simulate',
        async processCallback() {
            return { verified: true, country: 'DE', ageVerified: true };
        },
        async simulateCompletion(): Promise<VerificationResult> {
            throw new Error('simulate-boom');
        },
    };
}

describe('VerificationService', () => {
    let service: VerificationService;

    beforeEach(() => {
        service = new VerificationService({
            mode: createNoSimulateMode({ verified: true, country: 'DE', ageVerified: true }),
            store: new InMemorySessionStore(),
            sessionTtlMs: 60_000,
        });
    });

    // -----------------------------------------------------------------------
    // createSession
    // -----------------------------------------------------------------------
    describe('createSession', () => {
        it('returns a PendingSession with PENDING status', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            expect(session.status).toBe(VerificationStatus.PENDING);
        });

        it('returns a session with a non-empty walletUrl containing the session id', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            expect(session.walletUrl).toBeTruthy();
            expect(session.walletUrl).toContain(session.id);
        });

        it('stores the session so it is retrievable via getSession', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            const retrieved = await service.getSession(session.id);
            expect(retrieved.id).toBe(session.id);
        });

        it('emits session:created with the pending session including walletUrl', async () => {
            const handler = vi.fn();
            service.on('session:created', handler);
            const session = await service.createSession({ type: VerificationType.AGE });
            expect(handler).toHaveBeenCalledTimes(1);
            const emitted = handler.mock.calls[0][0] as PendingSession;
            expect(emitted.id).toBe(session.id);
            expect(emitted.walletUrl).toBeTruthy();
            expect(emitted.status).toBe(VerificationStatus.PENDING);
        });

        it('includes countryWhitelist when provided', async () => {
            const session = await service.createSession({
                type: VerificationType.COUNTRY,
                countryWhitelist: ['DE', 'FR'],
            });
            expect(session.countryWhitelist).toEqual(['DE', 'FR']);
        });

        it('includes metadata and redirectUrl', async () => {
            const session = await service.createSession({
                type: VerificationType.AGE,
                redirectUrl: 'https://example.com/done',
                metadata: { orderId: crypto.randomUUID() },
            });
            expect(session.redirectUrl).toBe('https://example.com/done');
            expect(session.metadata).toBeDefined();
        });

        it('validates input and throws on invalid country codes', async () => {
            await expect(
                service.createSession({
                    type: VerificationType.COUNTRY,
                    countryWhitelist: ['XX'],
                }),
            ).rejects.toThrow('invalid ISO 3166-1 alpha-2 codes');
        });

        it('validates input and throws when whitelist and blacklist both provided', async () => {
            await expect(
                service.createSession({
                    type: VerificationType.COUNTRY,
                    countryWhitelist: ['DE'],
                    countryBlacklist: ['FR'],
                }),
            ).rejects.toThrow('cannot both be provided');
        });
    });

    // -----------------------------------------------------------------------
    // getSession
    // -----------------------------------------------------------------------
    describe('getSession', () => {
        it('returns the session by ID', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            const result = await service.getSession(session.id);
            expect(result.id).toBe(session.id);
        });

        it('throws SessionNotFoundError for unknown ID', async () => {
            await expect(service.getSession(crypto.randomUUID())).rejects.toThrow(SessionNotFoundError);
        });
    });

    // -----------------------------------------------------------------------
    // handleCallback
    // -----------------------------------------------------------------------
    describe('handleCallback', () => {
        it('completes a session to VERIFIED when result.verified is true', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            const result = await service.handleCallback(session.id, {});
            expect(result.verified).toBe(true);
            const updated = await service.getSession(session.id);
            expect(updated.status).toBe(VerificationStatus.VERIFIED);
        });

        it('returns a CompletedSession with result and completedAt after verification', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            await service.handleCallback(session.id, {});
            const updated = (await service.getSession(session.id)) as CompletedSession;
            expect(updated.result).toBeDefined();
            expect(updated.result.verified).toBe(true);
            expect(updated.completedAt).toBeInstanceOf(Date);
        });

        it('completes a session to REJECTED when result.verified is false', async () => {
            const rejectMode = createNoSimulateMode({
                verified: false,
                rejectionReason: 'age_below_threshold',
            });
            const svc = new VerificationService({ mode: rejectMode });
            const session = await svc.createSession({ type: VerificationType.AGE });
            const result = await svc.handleCallback(session.id, {});
            expect(result.verified).toBe(false);
            const updated = await svc.getSession(session.id);
            expect(updated.status).toBe(VerificationStatus.REJECTED);
        });

        it('emits session:verified on successful verification', async () => {
            const handler = vi.fn();
            service.on('session:verified', handler);
            const session = await service.createSession({ type: VerificationType.AGE });
            await service.handleCallback(session.id, {});
            expect(handler).toHaveBeenCalledTimes(1);
            const [emittedSession, emittedResult] = handler.mock.calls[0] as [CompletedSession, VerificationResult];
            expect(emittedSession.id).toBe(session.id);
            expect(emittedResult.verified).toBe(true);
        });

        it('emits session:rejected on rejection', async () => {
            const rejectMode = createNoSimulateMode({
                verified: false,
                rejectionReason: 'country_blocked',
            });
            const svc = new VerificationService({ mode: rejectMode });
            const handler = vi.fn();
            svc.on('session:rejected', handler);
            const session = await svc.createSession({ type: VerificationType.AGE });
            await svc.handleCallback(session.id, {});
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler.mock.calls[0][1]).toBe('country_blocked');
        });

        it('throws SessionNotFoundError for unknown session ID', async () => {
            await expect(service.handleCallback(crypto.randomUUID(), {})).rejects.toThrow(SessionNotFoundError);
        });

        it('throws SessionExpiredError for an expired session', async () => {
            const svc = new VerificationService({
                mode: createNoSimulateMode({ verified: true }),
                sessionTtlMs: 1, // 1ms TTL
            });
            const session = await svc.createSession({ type: VerificationType.AGE });
            await new Promise((r) => setTimeout(r, 10));
            await expect(svc.handleCallback(session.id, {})).rejects.toThrow(SessionExpiredError);
        });

        it('removes session ID from internal tracking after completion', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            await service.handleCallback(session.id, {});
            // Access private sessionIds via cast to verify memory cleanup
            const ids = (service as unknown as { sessionIds: Set<string> }).sessionIds;
            expect(ids.has(session.id)).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // cancelSession
    // -----------------------------------------------------------------------
    describe('cancelSession', () => {
        it('cancels a pending session and removes it from the store', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            await service.cancelSession(session.id);
            await expect(service.getSession(session.id)).rejects.toThrow(SessionNotFoundError);
        });

        it('emits session:cancelled with the session', async () => {
            const handler = vi.fn();
            service.on('session:cancelled', handler);
            const session = await service.createSession({ type: VerificationType.AGE });
            await service.cancelSession(session.id);
            expect(handler).toHaveBeenCalledTimes(1);
            const emitted = handler.mock.calls[0][0] as BaseSession;
            expect(emitted.id).toBe(session.id);
        });

        it('throws SessionNotFoundError for unknown ID', async () => {
            await expect(service.cancelSession(crypto.randomUUID())).rejects.toThrow(SessionNotFoundError);
        });

        it('throws SessionNotPendingError when cancelling a completed session', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            await service.handleCallback(session.id, {});
            await expect(service.cancelSession(session.id)).rejects.toThrow(SessionNotPendingError);
        });

        it('removes session ID from internal tracking', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            await service.cancelSession(session.id);
            const ids = (service as unknown as { sessionIds: Set<string> }).sessionIds;
            expect(ids.has(session.id)).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // cleanupExpired
    // -----------------------------------------------------------------------
    describe('cleanupExpired', () => {
        it('removes expired pending sessions from store', async () => {
            const svc = new VerificationService({
                mode: createNoSimulateMode({ verified: true }),
                sessionTtlMs: 1,
            });
            const session = await svc.createSession({ type: VerificationType.AGE });
            await new Promise((r) => setTimeout(r, 10));
            const count = await svc.cleanupExpired();
            expect(count).toBe(1);
            await expect(svc.getSession(session.id)).rejects.toThrow(SessionNotFoundError);
        });

        it('emits session:expired for each expired session as ExpiredSession', async () => {
            const svc = new VerificationService({
                mode: createNoSimulateMode({ verified: true }),
                sessionTtlMs: 1,
            });
            const handler = vi.fn();
            svc.on('session:expired', handler);
            await svc.createSession({ type: VerificationType.AGE });
            await svc.createSession({ type: VerificationType.COUNTRY });
            await new Promise((r) => setTimeout(r, 10));
            await svc.cleanupExpired();
            expect(handler).toHaveBeenCalledTimes(2);
            const expired = handler.mock.calls[0][0] as ExpiredSession;
            expect(expired.status).toBe(VerificationStatus.EXPIRED);
            expect(expired.completedAt).toBeInstanceOf(Date);
        });

        it('does not expire non-expired sessions', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            const count = await service.cleanupExpired();
            expect(count).toBe(0);
            const result = await service.getSession(session.id);
            expect(result.id).toBe(session.id);
        });

        it('does not expire already-completed sessions', async () => {
            const svc = new VerificationService({
                mode: createNoSimulateMode({ verified: true }),
                sessionTtlMs: 1,
            });
            const session = await svc.createSession({ type: VerificationType.AGE });
            await svc.handleCallback(session.id, {});
            await new Promise((r) => setTimeout(r, 10));
            const count = await svc.cleanupExpired();
            expect(count).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // destroy
    // -----------------------------------------------------------------------
    describe('destroy', () => {
        it('removes all listeners after destroy', () => {
            const handler = vi.fn();
            service.on('session:created', handler);
            service.destroy();
            expect(service.listenerCount('session:created')).toBe(0);
        });

        it('causes createSession to throw ServiceDestroyedError', async () => {
            service.destroy();
            await expect(
                service.createSession({ type: VerificationType.AGE }),
            ).rejects.toThrow(ServiceDestroyedError);
        });

        it('causes getSession to throw ServiceDestroyedError', async () => {
            service.destroy();
            await expect(
                service.getSession(crypto.randomUUID()),
            ).rejects.toThrow(ServiceDestroyedError);
        });

        it('causes handleCallback to throw ServiceDestroyedError', async () => {
            service.destroy();
            await expect(
                service.handleCallback(crypto.randomUUID(), {}),
            ).rejects.toThrow(ServiceDestroyedError);
        });

        it('causes cancelSession to throw ServiceDestroyedError', async () => {
            service.destroy();
            await expect(
                service.cancelSession(crypto.randomUUID()),
            ).rejects.toThrow(ServiceDestroyedError);
        });

        it('causes cleanupExpired to throw ServiceDestroyedError', async () => {
            service.destroy();
            await expect(service.cleanupExpired()).rejects.toThrow(ServiceDestroyedError);
        });
    });

    // -----------------------------------------------------------------------
    // Memory leak: sessionIds tracking
    // -----------------------------------------------------------------------
    describe('memory leak prevention', () => {
        it('sessionIds Set is empty after completing 50+ sessions', async () => {
            const svc = new VerificationService({
                mode: createNoSimulateMode({ verified: true, country: 'DE' }),
                store: new InMemorySessionStore(),
                sessionTtlMs: 60_000,
            });

            const sessionCount = 55;
            const sessionIdList: string[] = [];

            for (let i = 0; i < sessionCount; i++) {
                const s = await svc.createSession({ type: VerificationType.AGE });
                sessionIdList.push(s.id);
            }

            // All 55 tracked
            const ids = (svc as unknown as { sessionIds: Set<string> }).sessionIds;
            expect(ids.size).toBe(sessionCount);

            // Complete all
            for (const sid of sessionIdList) {
                await svc.handleCallback(sid, {});
            }

            // All removed from tracking
            expect(ids.size).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // Race condition: DemoMode auto-complete vs explicit handleCallback
    // -----------------------------------------------------------------------
    describe('race condition handling', () => {
        it('handles immediate handleCallback while DemoMode is still waiting', async () => {
            const svc = new VerificationService({
                mode: new DemoMode({ delayMs: 500 }),
                store: new InMemorySessionStore(),
                sessionTtlMs: 60_000,
            });

            const verifiedHandler = vi.fn();
            svc.on('session:verified', verifiedHandler);

            const session = await svc.createSession({ type: VerificationType.AGE });

            // Immediately handle the callback (before DemoMode's 500ms timer fires)
            const result = await svc.handleCallback(session.id, {});
            expect(result.verified).toBe(true);

            // Wait for DemoMode's simulateCompletion to resolve
            await new Promise((r) => setTimeout(r, 600));

            // Should only have emitted once (the explicit handleCallback),
            // because simulateCompletion sees the session is no longer PENDING
            expect(verifiedHandler).toHaveBeenCalledTimes(1);
        });
    });

    // -----------------------------------------------------------------------
    // Error event: simulateCompletion failure
    // -----------------------------------------------------------------------
    describe('error event emission', () => {
        it('emits error event when simulateCompletion throws', async () => {
            const svc = new VerificationService({
                mode: createThrowingSimulateMode(),
                store: new InMemorySessionStore(),
                sessionTtlMs: 60_000,
            });

            const errorHandler = vi.fn();
            svc.on('error', errorHandler);

            await svc.createSession({ type: VerificationType.AGE });

            // Wait a tick for the microtask to complete
            await new Promise((r) => setTimeout(r, 50));

            expect(errorHandler).toHaveBeenCalledTimes(1);
            const [error, sessionId] = errorHandler.mock.calls[0] as [Error, string];
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('simulate-boom');
            expect(sessionId).toBeTruthy();
        });
    });

    // -----------------------------------------------------------------------
    // Config validation
    // -----------------------------------------------------------------------
    describe('config validation', () => {
        it('throws on negative sessionTtlMs', () => {
            expect(() => {
                new VerificationService({
                    mode: createNoSimulateMode({ verified: true }),
                    sessionTtlMs: -1,
                });
            }).toThrow('sessionTtlMs must be a positive number');
        });

        it('throws on empty walletBaseUrl', () => {
            expect(() => {
                new VerificationService({
                    mode: createNoSimulateMode({ verified: true }),
                    walletBaseUrl: '',
                });
            }).toThrow('walletBaseUrl must be a non-empty string');
        });

        it('throws on whitespace-only walletBaseUrl', () => {
            expect(() => {
                new VerificationService({
                    mode: createNoSimulateMode({ verified: true }),
                    walletBaseUrl: '   ',
                });
            }).toThrow('walletBaseUrl must be a non-empty string');
        });
    });
});
