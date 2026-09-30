import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CATALOG_PREFETCH_JS } from '../catalog-prefetch';
import { RENTAL_PREFETCH_JS } from '../rental-prefetch';

const nginxConf = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../nginx.conf'),
    'utf8',
);
const cspLines = nginxConf.split('\n').filter((l) => l.includes('add_header Content-Security-Policy-Report-Only'));
const sha256 = (body: string) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;

describe('nginx CSP allows the constant inline prefetch scripts by hash', () => {
    it('has both CSP headers and they are identical', () => {
        expect(cspLines).toHaveLength(2);
        expect(cspLines[0].trim()).toBe(cspLines[1].trim());
    });

    it.each([
        ['CATALOG_PREFETCH_JS', CATALOG_PREFETCH_JS],
        ['RENTAL_PREFETCH_JS', RENTAL_PREFETCH_JS],
    ])('%s hash is in script-src of both CSP headers', (_name, body) => {
        for (const line of cspLines) {
            const scriptSrc = line.match(/script-src ([^;]*);/)![1];
            expect(scriptSrc).toContain(sha256(body));
        }
    });
});
