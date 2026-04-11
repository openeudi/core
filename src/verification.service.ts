import { EventEmitter } from 'node:events';

import { v4 as uuidv4 } from 'uuid';

import { SessionNotFoundError, SessionExpiredError } from './errors.js';
import type { IVerificationMode } from './modes/mode.interface.js';
import { InMemorySessionStore } from './storage/memory.store.js';
import type { ISessionStore } from './storage/store.interface.js';
import type { VerificationServiceConfig } from './types/config.js';
import type { VerificationSession, VerificationResult, CreateSessionInput } from './types/session.js';
import { VerificationStatus } from './types/verification.js';

const DEFAULT_TTL_MS = 300_000; // 5 minutes
const DEFAULT_WALLET_BASE_URL = 'openid4vp://verify';

/**
 * EUDI Wallet verification session orchestrator.
 *
 * Manages the lifecycle of verification sessions: creation, status tracking,
 * wallet callback handling, expiration, and event emission.
 *
 * Transport-agnostic — consumers wire events to SSE, WebSocket, polling, etc.
 */
export class VerificationService extends EventEmitter {
    private store: ISessionStore;
    private mode: IVerificationMode;
    private sessionTtlMs: number;
    private walletBaseUrl: string;
    /** Track session IDs for cleanup (store interface has no list method) */
    private sessionIds = new Set<string>();

    constructor(config: VerificationServiceConfig) {
        super();
        this.mode = config.mode;
        this.store = config.store ?? new InMemorySessionStore();
        this.sessionTtlMs = config.sessionTtlMs ?? DEFAULT_TTL_MS;
        this.walletBaseUrl = config.walletBaseUrl ?? DEFAULT_WALLET_BASE_URL;
    }

    /**
     * Create a new verification session
     */
    async createSession(input: CreateSessionInput): Promise<VerificationSession> {
        const id = uuidv4();
        const now = new Date();

        const session: VerificationSession = {
            id,
            type: input.type,
            status: VerificationStatus.PENDING,
            walletUrl: '', // set below, may be async from mode
            countryWhitelist: input.countryWhitelist,
            countryBlacklist: input.countryBlacklist,
            redirectUrl: input.redirectUrl,
            metadata: input.metadata,
            createdAt: now,
            expiresAt: new Date(now.getTime() + this.sessionTtlMs),
        };

        session.walletUrl = this.mode.buildWalletUrl
            ? await this.mode.buildWalletUrl(id, input)
            : `${this.walletBaseUrl}?session=${id}`;

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
                .catch(() => {
                    // Ignore simulation errors (session may have been completed manually)
                });
        }

        return session;
    }

    /**
     * Get a session by ID
     * @throws SessionNotFoundError
     */
    async getSession(id: string): Promise<VerificationSession> {
        const session = await this.store.get(id);
        if (!session) {
            throw new SessionNotFoundError(id);
        }
        return session;
    }

    /**
     * Handle a callback from the wallet
     * @throws SessionNotFoundError
     * @throws SessionExpiredError
     */
    async handleCallback(sessionId: string, walletResponse: unknown): Promise<VerificationResult> {
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
     * Remove expired sessions from the store
     * @returns Number of sessions cleaned up
     */
    async cleanupExpired(): Promise<number> {
        const now = new Date();
        let count = 0;

        for (const id of this.sessionIds) {
            const session = await this.store.get(id);
            if (!session) {
                this.sessionIds.delete(id);
                continue;
            }
            if (now > session.expiresAt && session.status === VerificationStatus.PENDING) {
                const expired = { ...session, status: VerificationStatus.EXPIRED };
                await this.store.set(expired);
                await this.store.delete(id);
                this.sessionIds.delete(id);
                this.emit('session:expired', expired);
                count++;
            }
        }

        return count;
    }

    private async completeSession(session: VerificationSession, result: VerificationResult): Promise<void> {
        const status = result.verified ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;
        const updated: VerificationSession = {
            ...session,
            status,
            completedAt: new Date(),
            result,
        };

        await this.store.set(updated);

        if (result.verified) {
            this.emit('session:verified', updated, result);
        } else {
            this.emit('session:rejected', updated, result.rejectionReason);
        }
    }
}
