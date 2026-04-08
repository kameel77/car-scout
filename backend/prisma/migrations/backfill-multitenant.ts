/**
 * Backfill migration: Convert legacy User.role to Membership records
 * 
 * Run with: npx tsx prisma/migrations/backfill-multitenant.ts
 * 
 * This script:
 * 1. Creates Membership records for existing users based on their legacy role
 * 2. Does NOT delete User.role (that happens in Etap 5)
 * 3. Is idempotent — safe to run multiple times
 */

import { PrismaClient, ScopeType, MemberRole } from '@prisma/client';

const prisma = new PrismaClient();

const ROLE_MAP: Record<string, MemberRole> = {
    admin: MemberRole.SUPERADMIN_PLATFORM,
    manager: MemberRole.PLATFORM_MANAGER,
};

async function main() {
    console.log('🔄 Starting multi-tenant backfill migration...\n');

    // 1. Get all users
    const users = await prisma.user.findMany({
        select: { id: true, email: true, role: true },
    });
    console.log(`Found ${users.length} users to process.`);

    let created = 0;
    let skipped = 0;

    for (const user of users) {
        const memberRole = ROLE_MAP[user.role];
        if (!memberRole) {
            console.warn(`⚠️  Unknown role "${user.role}" for user ${user.email} — skipping`);
            skipped++;
            continue;
        }

        // Check if membership already exists (idempotency)
        const existing = await prisma.membership.findFirst({
            where: {
                userId: user.id,
                scopeType: ScopeType.PLATFORM,
                scopeId: 'PLATFORM',
                role: memberRole,
            },
        });

        if (existing) {
            console.log(`  ⏭️  ${user.email}: membership already exists — skipping`);
            skipped++;
            continue;
        }

        await prisma.membership.create({
            data: {
                userId: user.id,
                scopeType: ScopeType.PLATFORM,
                scopeId: 'PLATFORM',
                role: memberRole,
                isDefaultContext: true,
            },
        });
        console.log(`  ✅ ${user.email}: ${user.role} → ${memberRole}`);
        created++;
    }

    console.log(`\n📊 Summary: ${created} created, ${skipped} skipped.`);
    console.log('✅ Backfill complete.\n');
}

main()
    .catch((e) => {
        console.error('❌ Backfill failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
