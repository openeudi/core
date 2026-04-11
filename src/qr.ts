/**
 * Generate a QR code data URI from a wallet URL.
 *
 * Requires `qrcode` as an optional peer dependency.
 * Import from `@openeudi/core/qr` to use this function.
 *
 * @param url - The wallet URL to encode as QR code
 * @returns Base64 PNG data URI string
 * @throws Error if `qrcode` package is not installed
 */
export async function generateQRCode(url: string): Promise<string> {
    try {
        const QRCode = await import('qrcode');
        return await QRCode.toDataURL(url, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes('Cannot find module')) {
            throw new Error('@openeudi/core/qr requires the "qrcode" package. Install it: npm install qrcode');
        }
        throw error;
    }
}
