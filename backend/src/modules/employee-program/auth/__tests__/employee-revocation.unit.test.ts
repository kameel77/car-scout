import { it, expect, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { PrismaClient } from '@prisma/client';
import { authenticateEmployee, getEmployeeProfile } from '../employee-auth.service.js';

it('rejects revoked membership even if isActive was left true', async () => {
  const account = {
    id: 'fixture', email: 'fixture@example.invalid', isActive: true,
    passwordHash: await bcrypt.hash('fixture-password', 10), createdAt: new Date(),
    membership: {
      companyId: 'company', programId: 'program', isActive: true, revokedAt: new Date(),
      company: { id: 'company', name: 'Fixture', slug: 'fixture', isActive: true },
      program: { id: 'program', name: 'Fixture', slug: 'fixture', isActive: true },
    },
  };
  const prisma = { employeeAccount: { findUnique: vi.fn().mockResolvedValue(account), update: vi.fn() } } as unknown as PrismaClient;
  await expect(authenticateEmployee(prisma, account.email, 'fixture-password')).rejects.toMatchObject({ statusCode: 403 });
  await expect(getEmployeeProfile(prisma, account.id)).rejects.toMatchObject({ statusCode: 403 });
});
