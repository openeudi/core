import { describe, it, expect } from 'vitest';

import { generateQRCode } from '../src/qr.js';

describe('generateQRCode', () => {
    it('generates a data URI from a URL string', async () => {
        const dataUri = await generateQRCode('openid4vp://verify?session=abc-123');
        expect(dataUri).toMatch(/^data:image\/png;base64,/);
    });

    it('produces a non-trivial output', async () => {
        const dataUri = await generateQRCode('https://example.com');
        expect(typeof dataUri).toBe('string');
        expect(dataUri.length).toBeGreaterThan(100);
    });
});
