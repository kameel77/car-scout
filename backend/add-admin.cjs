const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@carscout.pl';
  const plain = process.env.ADMIN_PASSWORD || 'TwojeHaslo123!';

  const prisma = new PrismaClient();
  try {
    const password = await bcrypt.hash(plain, 10);
    await prisma.user.upsert({
      where: { email },
      update: { password, name: 'Admin', role: 'admin', isActive: true },
      create: { email, password, name: 'Admin', role: 'admin', isActive: true }
    });
    console.log('Admin ready:', email);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
