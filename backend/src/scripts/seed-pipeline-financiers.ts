import { PrismaClient, ScopeType, FinancingType, ClientType } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedPipelineFinanciers() {
  console.log('🌱 Seeding Pipeline Financiers (Ayvens)...');

  const ayvens = await prisma.pipelineFinancier.upsert({
    where: {
      scopeType_scopeId_code: {
        scopeType: ScopeType.PLATFORM,
        scopeId: 'PLATFORM',
        code: 'AYVENS',
      },
    },
    update: {
      name: 'Ayvens',
      isActive: true,
      supportedFinancing: [FinancingType.RENTAL],
      supportedClientTypes: [ClientType.B2C, ClientType.B2B],
      applicationEmailTo: ['wnioski@leaseplan.com'],
      applicationEmailCc: [],
    },
    create: {
      scopeType: ScopeType.PLATFORM,
      scopeId: 'PLATFORM',
      code: 'AYVENS',
      name: 'Ayvens',
      isActive: true,
      supportedFinancing: [FinancingType.RENTAL],
      supportedClientTypes: [ClientType.B2C, ClientType.B2B],
      applicationEmailTo: ['wnioski@leaseplan.com'],
      applicationEmailCc: [],
    },
  });

  console.log(`✅ Ayvens financier seeded: ${ayvens.id} (${ayvens.code}) -> emails: ${ayvens.applicationEmailTo.join(', ')}`);
}

// Allow direct execution
if (process.argv[1] && process.argv[1].endsWith('seed-pipeline-financiers.ts')) {
  seedPipelineFinanciers()
    .catch((err) => {
      console.error('❌ Failed to seed pipeline financiers:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
