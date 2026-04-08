import { PrismaClient, ScopeType, MemberRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@carscout.pl' },
        update: {
            password: hashedPassword,
            name: 'Admin User',
            role: 'admin',
            isActive: true
        },
        create: {
            email: 'admin@carscout.pl',
            password: hashedPassword,
            name: 'Admin User',
            role: 'admin',
            isActive: true
        }
    });

    console.log('✅ Created admin user:', admin.email);
    console.log('   Password: admin123');
    console.log('   (Change this in production!)');

    // Create PLATFORM membership for admin (idempotent)
    await prisma.membership.upsert({
        where: {
            userId_scopeType_scopeId_role: {
                userId: admin.id,
                scopeType: ScopeType.PLATFORM,
                scopeId: 'PLATFORM',
                role: MemberRole.SUPERADMIN_PLATFORM,
            },
        },
        update: {},
        create: {
            userId: admin.id,
            scopeType: ScopeType.PLATFORM,
            scopeId: 'PLATFORM',
            role: MemberRole.SUPERADMIN_PLATFORM,
            isDefaultContext: true,
        },
    });
    console.log('✅ Created SUPERADMIN_PLATFORM membership for admin');

    // Create sample dealer
    const dealer = await prisma.dealer.upsert({
        where: {
            name_addressLine1: {
                name: 'Toyota Warszawa',
                addressLine1: 'ul. Puławska 123'
            }
        },
        update: {},
        create: {
            name: 'Toyota Warszawa',
            addressLine1: 'ul. Puławska 123',
            city: 'Warszawa',
            contactPhone: '+48 22 123 45 67',
            contactEmail: 'kontakt@toyota-warszawa.pl',
            contactName: 'Jan Kowalski',
            googleRating: 4.7,
            googleReviewCount: 234
        }
    });

    console.log('✅ Created sample dealer:', dealer.name);

    console.log('🎉 Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
