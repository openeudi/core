import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SessionNotFoundError, SessionExpiredError } from '../src/errors.js';
import { DemoMode } from '../src/modes/demo.mode.js';
import type { IVerificationMode } from '../src/modes/mode.interface.js';
import { InMemorySessionStore } from '../src/storage/memory.store.js';
import { VerificationType, VerificationStatus } from '../src/types/verification.js';
import { VerificationService } from '../src/verification.service.js';

/**
 * Creates a mode without simulateCompletion, so no background auto-completion
 * races with explicit handleCallback or cleanupExpired calls.
 */
function createNoSimulateMode(result: { verified: boolean; rejectionReason?: string }): IVerificationMode {
    return {
        name: 'test-no-simulate',
        async processCallback() {
            return result;
        },
    };
}

describe('VerificationService', () => {
    let service: VerificationService;

    beforeEach(() => {
        service = new VerificationService({
            mode: new DemoMode({ delayMs: 10 }),
            store: new InMemorySessionStore(),
            sessionTtlMs: 60_000,
        });
    });

    describe('createSession', () => {
        it('creates a session with PENDING status', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            expect(session.id).toBeDefined();
            expect(session.status).toBe(VerificationStatus.PENDING);
            expect(session.type).toBe(VerificationType.AGE);
            expect(session.walletUrl).toContain(session.id);
            expect(session.createdAt).toBeInstanceOf(Date);
            expect(session.expiresAt).toBeInstanceOf(Date);
        });

        it('stores session in the store', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            const retrieved = await service.getSession(session.id);
            expect(retrieved.id).toBe(session.id);
        });

        it('includes countryWhitelist when provided', async () => {
            const session = await service.createSession({
                type: VerificationType.COUNTRY,
                countryWhitelist: ['DE', 'FR'],
            });
            expect(session.countryWhitelist).toEqual(['DE', 'FR']);
        });

        it('emits session:created event', async () => {
            const handler = vi.fn();
            service.on('session:created', handler);
            const session = await service.createSession({ type: VerificationType.AGE });
            expect(handler).toHaveBeenCalledWith(session);
        });
    });

    describe('getSession', () => {
        it('returns session by ID', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            const result = await service.getSession(session.id);
            expect(result.id).toBe(session.id);
        });

        it('throws SessionNotFoundError for unknown ID', async () => {
            await expect(service.getSession(crypto.randomUUID())).rejects.toThrow(SessionNotFoundError);
        });
    });

    describe('handleCallback', () => {
        it('updates session to VERIFIED on success', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            const result = await service.handleCallback(session.id, {});
            expect(result.verified).toBe(true);
            const updated = await service.getSession(session.id);
            expect(updated.status).toBe(VerificationStatus.VERIFIED);
            expect(updated.completedAt).toBeInstanceOf(Date);
        });

        it('emits session:verified on success', async () => {
            const handler = vi.fn();
            service.on('session:verified', handler);
            const session = await service.createSession({ type: VerificationType.AGE });
            await service.handleCallback(session.id, {});
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler.mock.calls[0][0].id).toBe(session.id);
            expect(handler.mock.calls[0][1].verified).toBe(true);
        });

        it('emits session:rejected on failure', async () => {
            const mode = createNoSimulateMode({ verified: false, rejectionReason: 'age_below_threshold' });
            const svc = new VerificationService({ mode });
            const handler = vi.fn();
            svc.on('session:rejected', handler);
            const session = await svc.createSession({ type: VerificationType.AGE });
            await svc.handleCallback(session.id, {});
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler.mock.calls[0][1]).toBe('age_below_threshold');
        });

        it('throws SessionNotFoundError for unknown ID', async () => {
            await expect(service.handleCallback(crypto.randomUUID(), {})).rejects.toThrow(SessionNotFoundError);
        });

        it('throws SessionExpiredError for expired session', async () => {
            const svc = new VerificationService({
                mode: new DemoMode({ delayMs: 0 }),
                sessionTtlMs: 1, // 1ms TTL
            });
            const session = await svc.createSession({ type: VerificationType.AGE });
            await new Promise((r) => setTimeout(r, 10));
            await expect(svc.handleCallback(session.id, {})).rejects.toThrow(SessionExpiredError);
        });
    });

    describe('cleanupExpired', () => {
        it('removes expired sessions from store', async () => {
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

        it('emits session:expired for each cleaned session', async () => {
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
        });

        it('does not remove non-expired sessions', async () => {
            const session = await service.createSession({ type: VerificationType.AGE });
            const count = await service.cleanupExpired();
            expect(count).toBe(0);
            const result = await service.getSession(session.id);
            expect(result.id).toBe(session.id);
        });
    });
});
