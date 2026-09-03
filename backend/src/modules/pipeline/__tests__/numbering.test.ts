import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { allocateOpportunityNumber } from '../services/numbering.service.js';

describe('Atomic Opportunity Numbering Service', () => {
  const prisma = new PrismaClient();
  const testYear = 2999;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.pipelineNumberSequence.deleteMany({
      where: { year: testYear },
    });
  });

  afterAll(async () => {
    await prisma.pipelineNumberSequence.deleteMany({
      where: { year: testYear },
    });
    await prisma.$disconnect();
  });

  it('allocates 20 distinct numbers concurrently without aborts or duplicates', async () => {
    // Run 20 concurrent transactions
    const promises = Array.from({ length: 20 }).map(() =>
      prisma.$transaction((tx) => allocateOpportunityNumber(tx, testYear))
    );

    const numbers = await Promise.all(promises);

    // 1. Exactly 20 numbers returned
    expect(numbers).toHaveLength(20);

    // 2. All 20 numbers are distinct
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(20);

    // 3. Format is MTL-2999-XXXXX
    for (const num of numbers) {
      expect(num).toMatch(/^MTL-2999-\d{5}$/);
    }

    // 4. Extracted sequence numbers form a contiguous set 1..20
    const sequences = numbers
      .map((n) => parseInt(n.split('-')[2], 10))
      .sort((a, b) => a - b);

    expect(sequences).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});
