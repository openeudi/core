import { describe, it, expect, vi } from 'vitest';

import { SessionExpiredError, SessionNotFoundError, SessionNotPendingError } from '../src/errors.js';
import type { IVerificationMode } from '../src/modes/mode.interface.js';
import { InMemorySessionStore } from '../src/storage/memory.store.js';
import { PROCESSING_STATUS } from '../src/storage/store.interface.js';
import type { ISessionStore, StoredSession } from '../src/storage/store.interface.js';
import type { CompletedSession, VerificationResult, VerificationSession } from '../src/types/session.js';
import { VerificationStatus, VerificationType } from '../src/types/verification.js';
import { VerificationService } from '../src/verification.service.js';

const EU_COUNTRIES = ['AT', 'BE', 'DE', 'ES', 'FR', 'HU', 'IT', 'LU', 'NL', 'PL'];

function randomCountry(): string {
    return EU_COUNTRIES[Math.floor(Math.random() * EU_COUNTRIES.length)];
}

function randomVerified(): VerificationResult {
    return { verified: true, country: randomCountry(), ageVerified: true };
}

function randomRejected(): VerificationResult {
    return { verified: false, country: randomCountry(), rejectionReason: crypto.randomUUID() };
}

/** A mode that returns the queued results in order and counts its calls. */
function createSequenceMode(results: VerificationResult[]): IVerificationMode & { calls: number } {
    const mode = {
        name: 'test-sequence',
        calls: 0,
        async processCallback(): Promise<VerificationResult> {
            const result = results[mode.calls] ?? results[results.length - 1];
            mode.calls++;
            return result;
        },
    };
    return mode;
}

/**
 * A mode whose processCallback stays pending until the test releases it, so a
 * second callback can be sent while the first is being processed.
 */
function createGatedMode() {
    let release: (result: VerificationResult) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    const mode: IVerificationMode & { calls: number } = {
        name: 'test-gated',
        calls: 0,
        processCallback() {
            mode.calls++;
            return new Promise<VerificationResult>((resolve, reject) => {
                release = resolve;
                fail = reject;
            });
        },
    };
    return {
        mode,
        /** Resolves once processCallback has been entered `count` times in total */
        async entered(count = 1): Promise<void> {
            while (mode.calls < count) {
                await new Promise((r) => setTimeout(r, 1));
            }
        },
        /** Settle the most recent processCallback call */
        release: (result: VerificationResult) => release(result),
        fail: (error: Error) => fail(error),
    };
}

/** A third-party style store that implements only the required methods. */
class BasicStore implements ISessionStore {
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
}

const stores: Array<[string, () => ISessionStore]> = [
    ['a store with compareAndSet', () => new InMemorySessionStore()],
    ['a store without compareAndSet', () => new BasicStore()],
];

describe.each(stores)('VerificationService.handleCallback accepts one callback per session (%s)', (_label, makeStore) => {
    it('refuses a second callback after REJECTED and keeps the first outcome', async () => {
        const first = randomRejected();
        const mode = createSequenceMode([first, randomVerified()]);
        const service = new VerificationService({ mode, store: makeStore() });
        const verified = vi.fn();
        const rejected = vi.fn();
        service.on('session:verified', verified);
        service.on('session:rejected', rejected);
        const session = await service.createSession({ type: VerificationType.AGE });

        await service.handleCallback(session.id, {});
        const second = service.handleCallback(session.id, {});

        await expect(second).rejects.toThrow(SessionNotPendingError);
        await expect(second).rejects.toMatchObject({ currentStatus: VerificationStatus.REJECTED });
        const stored = (await service.getSession(session.id)) as CompletedSession;
        expect(stored.status).toBe(VerificationStatus.REJECTED);
        expect(stored.result).toEqual(first);
        expect(mode.calls).toBe(1);
        expect(rejected).toHaveBeenCalledTimes(1);
        expect(verified).not.toHaveBeenCalled();
    });

    it('refuses a second callback after VERIFIED and emits nothing for it', async () => {
        const first = randomVerified();
        const mode = createSequenceMode([first, randomRejected()]);
        const service = new VerificationService({ mode, store: makeStore() });
        const verified = vi.fn();
        const rejected = vi.fn();
        service.on('session:verified', verified);
        service.on('session:rejected', rejected);
        const session = await service.createSession({ type: VerificationType.AGE });

        await service.handleCallback(session.id, {});

        await expect(service.handleCallback(session.id, {})).rejects.toThrow(SessionNotPendingError);
        const stored = (await service.getSession(session.id)) as CompletedSession;
        expect(stored.status).toBe(VerificationStatus.VERIFIED);
        expect(stored.result).toEqual(first);
        expect(mode.calls).toBe(1);
        expect(verified).toHaveBeenCalledTimes(1);
        expect(rejected).not.toHaveBeenCalled();
    });

    it('processes exactly one of two concurrent callbacks', async () => {
        const mode = createSequenceMode([randomRejected(), randomVerified()]);
        const service = new VerificationService({ mode, store: makeStore() });
        const verified = vi.fn();
        const rejected = vi.fn();
        service.on('session:verified', verified);
        service.on('session:rejected', rejected);
        const session = await service.createSession({ type: VerificationType.AGE });

        const outcomes = await Promise.allSettled([
            service.handleCallback(session.id, {}),
            service.handleCallback(session.id, {}),
        ]);

        const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
        const refused = outcomes.filter((o): o is PromiseRejectedResult => o.status === 'rejected');
        expect(fulfilled).toHaveLength(1);
        expect(refused).toHaveLength(1);
        expect(refused[0].reason).toBeInstanceOf(SessionNotPendingError);
        expect(mode.calls).toBe(1);
        expect(verified.mock.calls.length + rejected.mock.calls.length).toBe(1);
        expect((await service.getSession(session.id)).status).toBe(VerificationStatus.REJECTED);
    });

    it('refuses a callback that arrives while another is being processed', async () => {
        const gated = createGatedMode();
        const service = new VerificationService({ mode: gated.mode, store: makeStore() });
        const session = await service.createSession({ type: VerificationType.AGE });

        const first = service.handleCallback(session.id, {});
        await gated.entered();

        await expect(service.handleCallback(session.id, {})).rejects.toMatchObject({
            name: 'SessionNotPendingError',
            currentStatus: PROCESSING_STATUS,
        });
        const outcome = randomVerified();
        gated.release(outcome);
        await expect(first).resolves.toEqual(outcome);
        expect(gated.mode.calls).toBe(1);
    });

    it('reports a session as PENDING while its callback is processed', async () => {
        const gated = createGatedMode();
        const service = new VerificationService({ mode: gated.mode, store: makeStore() });
        const session = await service.createSession({ type: VerificationType.AGE });

        const first = service.handleCallback(session.id, {});
        await gated.entered();

        expect((await service.getSession(session.id)).status).toBe(VerificationStatus.PENDING);
        gated.release(randomVerified());
        await first;
        expect((await service.getSession(session.id)).status).toBe(VerificationStatus.VERIFIED);
    });

    it('returns the session to PENDING when processCallback throws, so the wallet can retry', async () => {
        const gated = createGatedMode();
        const service = new VerificationService({ mode: gated.mode, store: makeStore() });
        const session = await service.createSession({ type: VerificationType.AGE });
        const failure = new Error(crypto.randomUUID());

        const first = service.handleCallback(session.id, {});
        await gated.entered();
        gated.fail(failure);

        await expect(first).rejects.toBe(failure);
        expect((await service.getSession(session.id)).status).toBe(VerificationStatus.PENDING);

        const retry = service.handleCallback(session.id, {});
        await gated.entered(2);
        const outcome = randomVerified();
        gated.release(outcome);
        await expect(retry).resolves.toEqual(outcome);
    });

    it('refuses to cancel a session whose callback is being processed', async () => {
        const gated = createGatedMode();
        const service = new VerificationService({ mode: gated.mode, store: makeStore() });
        const cancelled = vi.fn();
        service.on('session:cancelled', cancelled);
        const session = await service.createSession({ type: VerificationType.AGE });

        const first = service.handleCallback(session.id, {});
        await gated.entered();

        await expect(service.cancelSession(session.id)).rejects.toThrow(SessionNotPendingError);
        gated.release(randomVerified());
        await first;
        expect(cancelled).not.toHaveBeenCalled();
        expect((await service.getSession(session.id)).status).toBe(VerificationStatus.VERIFIED);
    });

    it('refuses a callback after the session was cancelled', async () => {
        const mode = createSequenceMode([randomVerified()]);
        const service = new VerificationService({ mode, store: makeStore() });
        const session = await service.createSession({ type: VerificationType.AGE });
        await service.cancelSession(session.id);

        await expect(service.handleCallback(session.id, {})).rejects.toThrow(SessionNotFoundError);
        expect(mode.calls).toBe(0);
    });

    it('refuses a callback after the session expired', async () => {
        const mode = createSequenceMode([randomVerified()]);
        const service = new VerificationService({ mode, store: makeStore(), sessionTtlMs: 1 });
        const session = await service.createSession({ type: VerificationType.AGE });
        await new Promise((r) => setTimeout(r, 10));

        await expect(service.handleCallback(session.id, {})).rejects.toThrow(SessionExpiredError);
        await service.cleanupExpired();
        await expect(service.handleCallback(session.id, {})).rejects.toThrow(SessionNotFoundError);
        expect(mode.calls).toBe(0);
    });

    it('lets cleanupExpired skip a session whose callback started before the TTL elapsed', async () => {
        const gated = createGatedMode();
        const service = new VerificationService({ mode: gated.mode, store: makeStore(), sessionTtlMs: 20 });
        const expired = vi.fn();
        service.on('session:expired', expired);
        const session = await service.createSession({ type: VerificationType.AGE });

        const first = service.handleCallback(session.id, {});
        await gated.entered();
        await new Promise((r) => setTimeout(r, 40));

        expect(await service.cleanupExpired()).toBe(0);
        gated.release(randomVerified());
        await first;
        expect(expired).not.toHaveBeenCalled();
        expect((await service.getSession(session.id)).status).toBe(VerificationStatus.VERIFIED);
    });
});

describe('VerificationService with a store shared by several instances', () => {
    it('processes exactly one of two callbacks sent to different instances', async () => {
        const store = new InMemorySessionStore();
        const gatedA = createGatedMode();
        const gatedB = createGatedMode();
        const serviceA = new VerificationService({ mode: gatedA.mode, store });
        const serviceB = new VerificationService({ mode: gatedB.mode, store });
        const session = await serviceA.createSession({ type: VerificationType.AGE });

        const first = serviceA.handleCallback(session.id, {});
        await gatedA.entered();

        await expect(serviceB.handleCallback(session.id, {})).rejects.toMatchObject({
            name: 'SessionNotPendingError',
            currentStatus: PROCESSING_STATUS,
        });
        gatedA.release(randomVerified());
        await first;
        expect(gatedB.mode.calls).toBe(0);
    });

    it('stores the PROCESSING marker only through compareAndSet', async () => {
        const store = new InMemorySessionStore();
        const gated = createGatedMode();
        const service = new VerificationService({ mode: gated.mode, store });
        const session = await service.createSession({ type: VerificationType.AGE });

        const first = service.handleCallback(session.id, {});
        await gated.entered();

        expect((await store.get(session.id))?.status).toBe(PROCESSING_STATUS);
        gated.release(randomRejected());
        await first;
        expect((await store.get(session.id))?.status).toBe(VerificationStatus.REJECTED);
    });

    it('does not emit when another instance removed the session during processing', async () => {
        const store = new InMemorySessionStore();
        const gated = createGatedMode();
        const service = new VerificationService({ mode: gated.mode, store });
        const verified = vi.fn();
        service.on('session:verified', verified);
        const session = await service.createSession({ type: VerificationType.AGE });

        const first = service.handleCallback(session.id, {});
        await gated.entered();
        await store.delete(session.id);
        gated.release(randomVerified());

        await expect(first).rejects.toThrow(SessionNotFoundError);
        expect(verified).not.toHaveBeenCalled();
    });

    it('expires sessions created by another instance when the store lists them', async () => {
        const store = new InMemorySessionStore();
        const mode = createSequenceMode([randomVerified()]);
        const creator = new VerificationService({ mode, store, sessionTtlMs: 1 });
        const sweeper = new VerificationService({ mode, store });
        const expired = vi.fn();
        sweeper.on('session:expired', expired);
        const session = await creator.createSession({ type: VerificationType.AGE });
        await new Promise((r) => setTimeout(r, 10));

        expect(await sweeper.cleanupExpired()).toBe(1);
        expect(expired).toHaveBeenCalledTimes(1);
        expect(await store.get(session.id)).toBeNull();
    });
});
