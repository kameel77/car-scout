import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetPassword() {
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('New hash:', hashedPassword);

    try {
        const user = await prisma.user.update({
            where: { email: 'admin@carscout.pl' },
            data: { password: hashedPassword }
        });
        console.log('Password updated successfully for:', user.email);
    } catch (e) {
        console.error('Error updating password:', e);
    } finally {
        await prisma.$disconnect();
    }
}

resetPassword();
