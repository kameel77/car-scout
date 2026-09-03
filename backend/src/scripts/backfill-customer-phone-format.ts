import { PrismaClient, ScopeType } from '@prisma/client';

// normalizePhone() w customer.service.ts zyskał regułę `/^48\d{9}$/ -> +48…`.
// Wcześniej numery zapisane jako 11 cyfr zaczynających się od 48 bez plusa
// przechodziły przez `return cleaned` i tak trafiały do pipeline_customers.phone.
// Po zmianie ten sam input normalizuje się do `+48…`, więc stare wiersze
// przestają się matchować przy dedupie klienta (findCustomerMatch) i w
// webhooku Thulium. Ten skrypt wykrywa takie wiersze i przepisuje je na format
// kanoniczny (+48…), pomijając te, dla których w tym samym scope istnieje już
// klient z docelowym numerem (kolizja — scalanie duplikatów jest poza zakresem).
// Uruchomienie (kontener): node dist/scripts/backfill-customer-phone-format.js
// Uruchomienie (lokalnie): npx tsx src/scripts/backfill-customer-phone-format.ts

const prisma = new PrismaClient();

async function run() {
    const apply = process.argv.includes('--apply');

    const [{ total, legacy_48, canonical }] = await prisma.$queryRaw<
        { total: bigint; legacy_48: bigint; canonical: bigint }[]
    >`
        SELECT
            count(*) FILTER (WHERE phone IS NOT NULL) AS total,
            count(*) FILTER (WHERE phone ~ '^48[0-9]{9}$') AS legacy_48,
            count(*) FILTER (WHERE phone ~ '^\\+48[0-9]{9}$') AS canonical
        FROM pipeline_customers
    `;

    console.log('Raport pipeline_customers.phone:');
    console.log(`  total: ${Number(total)}`);
    console.log(`  legacy_48 (48XXXXXXXXX): ${Number(legacy_48)}`);
    console.log(`  canonical (+48XXXXXXXXX): ${Number(canonical)}`);

    if (Number(legacy_48) === 0) {
        console.log('Brak wierszy legacy_48 — nic do zrobienia.');
        return;
    }

    const targets = await prisma.$queryRaw<
        { id: string; scopeType: ScopeType; scopeId: string; phone: string }[]
    >`
        SELECT id, scope_type AS "scopeType", scope_id AS "scopeId", phone
        FROM pipeline_customers
        WHERE phone ~ '^48[0-9]{9}$'
    `;

    let scanned = 0;
    let updated = 0;
    let skippedCollisions = 0;

    for (const row of targets) {
        scanned++;
        const target = `+${row.phone}`;

        const collision = await prisma.pipelineCustomer.findFirst({
            where: {
                scopeType: row.scopeType,
                scopeId: row.scopeId,
                phone: target,
                id: { not: row.id },
            },
        });

        if (collision) {
            skippedCollisions++;
            console.log(
                `KOLIZJA: klient ${row.id} (phone=${row.phone}) koliduje z klientem ${collision.id} (phone=${collision.phone}) w scope ${row.scopeType}/${row.scopeId} — pominięto.`
            );
            continue;
        }

        if (apply) {
            await prisma.pipelineCustomer.update({
                where: { id: row.id },
                data: { phone: target },
            });
        }
        updated++;
    }

    console.log('Podsumowanie:');
    console.log(`  przeskanowano: ${scanned}`);
    console.log(`  ${apply ? 'zaktualizowano' : 'byłoby zaktualizowanych'}: ${updated}`);
    console.log(`  pominięto z powodu kolizji: ${skippedCollisions}`);

    if (!apply) {
        console.log('DRY RUN — nic nie zostało zmienione w bazie. Uruchom z flagą --apply, aby zapisać zmiany.');
    }
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
