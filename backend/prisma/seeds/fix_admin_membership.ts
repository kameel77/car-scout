import { PrismaClient, ScopeType, MemberRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Znajdźmy użytkownika (możemy szukać po starym role: 'ADMIN' lub emailu)
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'ADMIN' },
        { email: { contains: 'kamil' } }
      ]
    },
    include: {
      memberships: true
    }
  });

  console.log(`Found ${users.length} matching users.`);

  for (const user of users) {
    console.log(`Processing user: ${user.email} (ID: ${user.id}, Role: ${user.role})`);
    
    // Sprawdzamy czy ma już membership PLATFORM -> SUPERADMIN_PLATFORM
    const hasPlatformSuperadmin = user.memberships.some(
      m => m.scopeType === ScopeType.PLATFORM && m.role === MemberRole.SUPERADMIN_PLATFORM
    );

    if (!hasPlatformSuperadmin) {
      console.log(`Creating PLATFORM / SUPERADMIN_PLATFORM membership for ${user.email}...`);
      await prisma.membership.create({
        data: {
          userId: user.id,
          scopeType: ScopeType.PLATFORM,
          scopeId: 'PLATFORM', // konwencja wg dokumentacji/kodu
          role: MemberRole.SUPERADMIN_PLATFORM,
          isDefaultContext: true,
        }
      });
      console.log(`Successfully created membership for ${user.email}.`);
    } else {
      console.log(`User ${user.email} already has SUPERADMIN_PLATFORM membership.`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
