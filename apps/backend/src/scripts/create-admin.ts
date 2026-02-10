import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@carscout.pl';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            isActive: true,
            role: 'admin'
        },
        create: {
            email,
            password: hashedPassword,
            name: 'Staging Admin',
            role: 'admin',
            isActive: true
        }
    });

    console.log('✅ Admin user created/updated successfully');
    console.log('Email:', email);
    console.log('Password:', password);
}

main()
    .catch((e) => {
        console.error('❌ Error creating admin:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
