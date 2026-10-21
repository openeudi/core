import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { VERSION } from '../src/index.js';

/**
 * The exported `VERSION` constant is maintained by hand, and the README once
 * documented a stale value for it. Nothing else in the suite compares it with
 * the real package version, so a release could ship a wrong `VERSION` without
 * any test noticing.
 */
describe('VERSION export', () => {
    it('matches the version in package.json', () => {
        const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
            version: string;
        };

        expect(VERSION).toBe(pkg.version);
    });
});
