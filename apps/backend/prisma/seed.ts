import { PrismaClient } from '@prisma/client';
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
