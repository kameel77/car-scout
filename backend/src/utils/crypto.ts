import crypto from 'crypto';

const CURRENT_KEY_VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(version: string = CURRENT_KEY_VERSION): Buffer {
    const rawKey = process.env.FEED_ENCRYPTION_KEY;
    if (!rawKey) {
        if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
            return crypto.createHash('sha256').update('test-feed-encryption-key-local-test-only').digest();
        }
        if (process.env.NODE_ENV === 'production') {
            throw new Error('[Crypto] KRYTYCZNY BŁĄD: Zmienna środowiskowa FEED_ENCRYPTION_KEY jest wymagana na środowisku produkcyjnym!');
        }
        console.warn('[Crypto] OSTRZEŻENIE: Brak FEED_ENCRYPTION_KEY w środowisku dev. Ustaw zmienną FEED_ENCRYPTION_KEY w .env!');
        return crypto.createHash('sha256').update('dev-local-feed-encryption-key-fallback').digest();
    }
    return crypto.createHash('sha256').update(`${version}:${rawKey}`).digest();
}

/**
 * Szyfruje tekst jawny za pomocą AES-256-GCM z wersjonowaniem klucza.
 * Zwraca ciąg w formacie: "v1:iv:authTag:ciphertext" w kodowaniu base64.
 */
export function encryptSecret(plainText: string): string {
    if (!plainText) return '';
    const key = getEncryptionKey(CURRENT_KEY_VERSION);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    
    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return `${CURRENT_KEY_VERSION}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Deszyfruje ciąg zaszyfrowany za pomocą encryptSecret.
 * Obsługuje format wersjonowany "v1:iv:authTag:ciphertext" oraz legacy "iv:authTag:ciphertext".
 */
export function decryptSecret(encryptedPayload: string): string {
    if (!encryptedPayload) return '';
    
    const parts = encryptedPayload.split(':');
    let version = CURRENT_KEY_VERSION;
    let ivB64: string;
    let authTagB64: string;
    let cipherB64: string;

    if (parts.length === 4 && parts[0].startsWith('v')) {
        // Nowy format wersjonowany: v1:iv:tag:ct
        version = parts[0];
        ivB64 = parts[1];
        authTagB64 = parts[2];
        cipherB64 = parts[3];
    } else if (parts.length === 3) {
        // Format legacy bez prefiksu wersji: iv:tag:ct
        version = 'v1';
        ivB64 = parts[0];
        authTagB64 = parts[1];
        cipherB64 = parts[2];
    } else {
        // Nieszyfrowany tekst (np. migracja danych)
        return encryptedPayload;
    }

    try {
        const key = getEncryptionKey(version);
        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(authTagB64, 'base64');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(cipherB64, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error('[Crypto] Błąd deszyfrowania sekretu:', err);
        throw new Error('Nie udało się odszyfrować poświadczeń');
    }
}
