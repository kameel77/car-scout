/**
 * GSC URL Inspection API — batch inspection of URLs.
 *
 * Answers the questions the Search Console UI cannot answer at scale:
 *  - which canonical did Google actually pick (googleCanonical vs userCanonical),
 *  - is the URL indexed, and if not, why (coverageState),
 *  - when was it last crawled.
 *
 * Setup (once, by a human):
 *  1. Google Cloud Console → enable "Google Search Console API" (searchconsole.googleapis.com).
 *  2. Create a service account, add a JSON key, download it.
 *  3. GSC → Ustawienia → Użytkownicy i uprawnienia → add the service account e-mail
 *     (…iam.gserviceaccount.com). URL Inspection requires OWNER-level access.
 *  4. Save the key as backend/.secrets/gsc-service-account.json (gitignored).
 *
 * Usage (from backend/):
 *   npx tsx src/scripts/gsc-inspect-urls.ts urls.txt > out.csv
 *   GSC_SITE='https://motolia.pl/' npx tsx src/scripts/gsc-inspect-urls.ts urls.txt > out.csv
 *
 * urls.txt: one absolute URL per line; blank lines and lines starting with # are ignored.
 *
 * API quota: 2000 inspections/day and 600/minute per property. The script paces itself at
 * ~4 req/s and retries once on 429/5xx.
 */
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Backend jest ESM ("type": "module"), więc __dirname nie istnieje — ten sam wzorzec
// co w pozostałych skryptach (patrz backfill-image-variants.ts).
const scriptDir = dirname(fileURLToPath(import.meta.url));

const KEY_PATH = process.env.GSC_SA_KEY_PATH
    ? resolve(process.env.GSC_SA_KEY_PATH)
    : resolve(scriptDir, '../../.secrets/gsc-service-account.json');

// Domenowa właściwość ('sc-domain:motolia.pl') widzi też subdomeny (dev.), prefiksowa tylko produkcję.
const SITE = process.env.GSC_SITE || 'sc-domain:motolia.pl';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const REQ_INTERVAL_MS = 250;

interface ServiceAccountKey {
    client_email: string;
    private_key: string;
    token_uri?: string;
}

function base64url(input: string | Buffer): string {
    return Buffer.from(input)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/** Podpisuje JWT ręcznie (node:crypto) — świadomie bez google-auth-library, żeby skrypt
 *  diagnostyczny nie dodawał zależności do produkcyjnego package.json. */
async function getAccessToken(key: ServiceAccountKey): Promise<string> {
    const tokenUri = key.token_uri || 'https://oauth2.googleapis.com/token';
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(
        JSON.stringify({
            iss: key.client_email,
            scope: SCOPE,
            aud: tokenUri,
            iat: now,
            exp: now + 3600,
        })
    );
    const signature = base64url(
        createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key.private_key)
    );

    const res = await fetch(tokenUri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${header}.${claims}.${signature}`,
        }),
    });
    if (!res.ok) {
        throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
    }
    return ((await res.json()) as { access_token: string }).access_token;
}

interface InspectionRow {
    url: string;
    verdict: string;
    coverageState: string;
    robotsTxtState: string;
    indexingState: string;
    googleCanonical: string;
    userCanonical: string;
    canonicalMatches: string;
    lastCrawlTime: string;
    pageFetchState: string;
    richResults: string;
    richResultTypes: string;
    error: string;
}

const EMPTY = (url: string): InspectionRow => ({
    url,
    verdict: '',
    coverageState: '',
    robotsTxtState: '',
    indexingState: '',
    googleCanonical: '',
    userCanonical: '',
    canonicalMatches: '',
    lastCrawlTime: '',
    pageFetchState: '',
    richResults: '',
    richResultTypes: '',
    error: '',
});

async function inspect(url: string, token: string, attempt = 0): Promise<InspectionRow> {
    const row = EMPTY(url);
    try {
        const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE, languageCode: 'pl' }),
        });

        if ((res.status === 429 || res.status >= 500) && attempt === 0) {
            await new Promise(r => setTimeout(r, 5000));
            return inspect(url, token, 1);
        }
        if (!res.ok) {
            row.error = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
            return row;
        }

        const result = ((await res.json()) as any).inspectionResult ?? {};
        const idx = result.indexStatusResult ?? {};
        row.verdict = idx.verdict ?? '';
        row.coverageState = idx.coverageState ?? '';
        row.robotsTxtState = idx.robotsTxtState ?? '';
        row.indexingState = idx.indexingState ?? '';
        row.googleCanonical = idx.googleCanonical ?? '';
        row.userCanonical = idx.userCanonical ?? '';
        row.canonicalMatches =
            idx.googleCanonical && idx.userCanonical
                ? String(idx.googleCanonical === idx.userCanonical)
                : '';
        row.lastCrawlTime = idx.lastCrawlTime ?? '';
        row.pageFetchState = idx.pageFetchState ?? '';
        row.richResults = result.richResultsResult?.verdict ?? '';
        // Sam verdict PASS nie mówi, JAKI typ Google wykrył — strona oferty ma zawsze
        // BreadcrumbList, więc bez tej listy nie da się stwierdzić, czy widzi też Product.
        row.richResultTypes = (result.richResultsResult?.detectedItems ?? [])
            .map((item: any) => `${item.richResultType ?? '?'}(${(item.items ?? []).length})`)
            .join(' | ');
    } catch (err: any) {
        row.error = err?.message ?? String(err);
    }
    return row;
}

function csvCell(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

async function main() {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.error('usage: npx tsx src/scripts/gsc-inspect-urls.ts <urls.txt> > out.csv');
        process.exit(1);
    }

    let key: ServiceAccountKey;
    try {
        key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
    } catch (err: any) {
        console.error(`Nie mogę wczytać klucza konta serwisowego z ${KEY_PATH}: ${err.message}`);
        console.error('Ustaw GSC_SA_KEY_PATH albo zapisz plik w backend/.secrets/gsc-service-account.json');
        process.exit(1);
    }

    const urls = readFileSync(resolve(inputPath), 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('#'));

    if (urls.length === 0) {
        console.error('Brak URL-i w pliku wejściowym.');
        process.exit(1);
    }
    if (urls.length > 2000) {
        console.error(`UWAGA: ${urls.length} URL-i przekracza dzienny limit API (2000). Podziel plik.`);
        process.exit(1);
    }

    const token = await getAccessToken(key);
    console.error(`Właściwość: ${SITE} — sprawdzam ${urls.length} URL-i...`);

    const header: (keyof InspectionRow)[] = [
        'url', 'verdict', 'coverageState', 'robotsTxtState', 'indexingState',
        'googleCanonical', 'userCanonical', 'canonicalMatches', 'lastCrawlTime',
        'pageFetchState', 'richResults', 'richResultTypes', 'error',
    ];
    console.log(header.join(','));

    for (let i = 0; i < urls.length; i++) {
        const row = await inspect(urls[i], token);
        console.log(header.map(k => csvCell(row[k])).join(','));
        if (i % 25 === 24) console.error(`  ${i + 1}/${urls.length}`);
        if (i < urls.length - 1) await new Promise(r => setTimeout(r, REQ_INTERVAL_MS));
    }

    console.error('Gotowe.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
