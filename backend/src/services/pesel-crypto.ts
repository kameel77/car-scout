import crypto from 'crypto';

export class PeselEncryptionUnavailableError extends Error {
    statusCode = 503;
    constructor(message = 'Usługa szyfrowania danych PESEL jest niedostępna (brak poprawnego klucza PESEL_ENCRYPTION_KEY)') {
        super(message);
        this.name = 'PeselEncryptionUnavailableError';
    }
}

export class PeselDecryptionError extends Error {
    statusCode = 500;
    constructor(message = 'Nie udało się odszyfrować numeru PESEL') {
        super(message);
        this.name = 'PeselDecryptionError';
    }
}

/**
 * Validates Polish PESEL checksum using standard weights: [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
 */
export function validatePeselChecksum(pesel: string): boolean {
    if (typeof pesel !== 'string') return false;
    const clean = pesel.trim();
    if (!/^\d{11}$/.test(clean)) return false;

    const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    let sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(clean[i], 10) * weights[i];
    }

    const controlDigit = (10 - (sum % 10)) % 10;
    return controlDigit === parseInt(clean[10], 10);
}

/**
 * Masks PESEL to 7 asterisks + 4 last digits: *******1234
 */
export function maskPesel(pesel: string): string {
    const clean = pesel.trim();
    if (clean.length < 4) return '*******';
    return '*******' + clean.slice(-4);
}

function getEncryptionKey(): Buffer {
    const rawKey = process.env.PESEL_ENCRYPTION_KEY;
    if (!rawKey) {
        throw new PeselEncryptionUnavailableError();
    }

    try {
        const buf = Buffer.from(rawKey.trim(), 'base64');
        if (buf.length !== 32) {
            throw new PeselEncryptionUnavailableError(
                `Nieprawidłowa długość klucza PESEL_ENCRYPTION_KEY: oczekiwano 32 bajtów po dekodowaniu base64, otrzymano ${buf.length}`
            );
        }
        return buf;
    } catch (err: any) {
        if (err instanceof PeselEncryptionUnavailableError) throw err;
        throw new PeselEncryptionUnavailableError(`Błąd dekodowania PESEL_ENCRYPTION_KEY: ${err?.message}`);
    }
}

/**
 * Encrypts PESEL with AES-256-GCM.
 * Format: "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>"
 */
export function encryptPesel(plain: string): string {
    if (!plain || !plain.trim()) {
        throw new Error('encryptPesel: plain text cannot be empty');
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // standard 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const ciphertext = Buffer.concat([
        cipher.update(plain.trim(), 'utf8'),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypts PESEL stored in format "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>"
 */
export function decryptPesel(stored: string): string {
    if (!stored || !stored.startsWith('v1:')) {
        throw new PeselDecryptionError('Nieprawidłowy format zaszyfrowanego PESEL (wymagany prefix v1:)');
    }

    const parts = stored.split(':');
    if (parts.length !== 4) {
        throw new PeselDecryptionError('Nieprawidłowa struktura zaszyfrowanego rekordu PESEL');
    }

    const [, ivB64, tagB64, ciphertextB64] = parts;

    try {
        const key = getEncryptionKey();
        const iv = Buffer.from(ivB64, 'base64');
        const tag = Buffer.from(tagB64, 'base64');
        const ciphertext = Buffer.from(ciphertextB64, 'base64');

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);

        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final()
        ]);

        return decrypted.toString('utf8');
    } catch (err: any) {
        if (err instanceof PeselEncryptionUnavailableError) throw err;
        throw new PeselDecryptionError(`Błąd deszyfrowania PESEL: ${err?.message}`);
    }
}
