import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySessionStore } from '../src/storage/memory.store.js';
import { VerificationType, VerificationStatus } from '../src/types/verification.js';
import type { VerificationSession } from '../src/types/session.js';

function createTestSession(overrides: Partial<VerificationSession> = {}): VerificationSession {
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
        const updated = { ...session, status: VerificationStatus.VERIFIED };
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
});
