require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const allCount = await prisma.listing.count();
  const activeCount = await prisma.listing.count({ where: { isArchived: false } });
  const archivedCount = await prisma.listing.count({ where: { isArchived: true } });
  
  console.log(`Total: ${allCount}`);
  console.log(`Active: ${activeCount}`);
  console.log(`Archived: ${archivedCount}`);
  
  const sources = await prisma.listing.groupBy({
    by: ['importSource'],
    _count: { id: true }
  });
  console.log('Sources:', sources);
  
  process.exit(0);
}

check().catch(console.error);
