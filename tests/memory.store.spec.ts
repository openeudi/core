import { describe, it, expect, beforeEach } from 'vitest';

import { InMemorySessionStore } from '../src/storage/memory.store.js';
import { PROCESSING_STATUS } from '../src/storage/store.interface.js';
import type { PendingSession } from '../src/types/session.js';
import { VerificationType, VerificationStatus } from '../src/types/verification.js';

function createTestSession(overrides: Partial<PendingSession> = {}): PendingSession {
    return {
        id: crypto.randomUUID(),
        type: VerificationType.AGE,
        status: VerificationStatus.PENDING,
        walletUrl: `openid4vp://verify?session=${crypto.randomUUID()}`,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 300_000),
        ...overrides,
    };
}

describe('InMemorySessionStore', () => {
    let store: InMemorySessionStore;

    beforeEach(() => {
        store = new InMemorySessionStore();
    });

    it('returns null for non-existent session', async () => {
        const result = await store.get(crypto.randomUUID());
        expect(result).toBeNull();
    });

    it('stores and retrieves a session', async () => {
        const session = createTestSession();
        await store.set(session);
        const result = await store.get(session.id);
        expect(result).toEqual(session);
    });

    it('overwrites existing session on set', async () => {
        const session = createTestSession();
        await store.set(session);
        const updated = { ...session, status: VerificationStatus.VERIFIED as const, result: { verified: true }, completedAt: new Date() };
        await store.set(updated);
        const result = await store.get(session.id);
        expect(result?.status).toBe(VerificationStatus.VERIFIED);
    });

    it('deletes a session', async () => {
        const session = createTestSession();
        await store.set(session);
        await store.delete(session.id);
        const result = await store.get(session.id);
        expect(result).toBeNull();
    });

    it('delete is a no-op for non-existent session', async () => {
        await expect(store.delete(crypto.randomUUID())).resolves.not.toThrow();
    });

    describe('compareAndSet', () => {
        it('replaces the session when the status matches', async () => {
            const session = createTestSession();
            await store.set(session);
            const next = { ...session, status: PROCESSING_STATUS };
            await expect(store.compareAndSet(session.id, VerificationStatus.PENDING, next)).resolves.toBe(true);
            expect((await store.get(session.id))?.status).toBe(PROCESSING_STATUS);
        });

        it('leaves the session untouched when the status differs', async () => {
            const session = createTestSession();
            await store.set(session);
            const next = { ...session, status: PROCESSING_STATUS };
            await expect(store.compareAndSet(session.id, PROCESSING_STATUS, next)).resolves.toBe(false);
            expect(await store.get(session.id)).toEqual(session);
        });

        it('returns false for a missing session and does not create it', async () => {
            const session = createTestSession();
            await expect(store.compareAndSet(session.id, VerificationStatus.PENDING, session)).resolves.toBe(false);
            expect(await store.get(session.id)).toBeNull();
        });

        it('lets only one of two concurrent claims succeed', async () => {
            const session = createTestSession();
            await store.set(session);
            const next = { ...session, status: PROCESSING_STATUS };
            const results = await Promise.all([
                store.compareAndSet(session.id, VerificationStatus.PENDING, next),
                store.compareAndSet(session.id, VerificationStatus.PENDING, next),
            ]);
            expect(results.filter(Boolean)).toHaveLength(1);
        });
    });

    describe('listExpired', () => {
        it('returns only PENDING sessions past their expiry', async () => {
            const now = new Date();
            const expired = createTestSession({ expiresAt: new Date(now.getTime() - 1 - Math.floor(Math.random() * 1000)) });
            const live = createTestSession({ expiresAt: new Date(now.getTime() + 1 + Math.floor(Math.random() * 1000)) });
            const completed = {
                ...createTestSession({ expiresAt: new Date(now.getTime() - 1) }),
                status: VerificationStatus.VERIFIED as const,
                result: { verified: true },
                completedAt: now,
            };
            await store.set(expired);
            await store.set(live);
            await store.set(completed);

            await expect(store.listExpired(now)).resolves.toEqual([expired.id]);
        });
    });
});
