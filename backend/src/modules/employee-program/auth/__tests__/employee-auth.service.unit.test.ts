import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import {
  hashRegistrationCode,
  validateRegistrationCode,
  registerEmployeeWithCode,
  authenticateEmployee,
  getEmployeeProfile
} from '../employee-auth.service.js';

describe('employee-auth.service comprehensive unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. hashRegistrationCode', () => {
    it('normalizes code with trim and uppercase before sha256 hashing', () => {
      const h1 = hashRegistrationCode('  test-code-123  ');
      const h2 = hashRegistrationCode('TEST-CODE-123');
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
    });

    it('rejects non-string, empty, whitespace-only, or overly long codes', () => {
      expect(() => hashRegistrationCode('')).toThrowError();
      expect(() => hashRegistrationCode('   ')).toThrowError();
      expect(() => hashRegistrationCode(null as any)).toThrowError();
      expect(() => hashRegistrationCode(undefined as any)).toThrowError();
      expect(() => hashRegistrationCode(12345 as any)).toThrowError();
      expect(() => hashRegistrationCode('a'.repeat(101))).toThrowError();
    });
  });

  describe('2. validateRegistrationCode', () => {
    it('returns valid info when code, company and program are active and not expired', async () => {
      const mockPrisma = {
        employeeRegistrationCode: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'c-1',
            companyId: 'comp-1',
            programId: 'prog-1',
            isActive: true,
            expiresAt: new Date(Date.now() + 100000),
            company: { id: 'comp-1', name: 'Acme Corp', slug: 'acme-corp', isActive: true },
            program: { id: 'prog-1', name: 'Auto Benefit', slug: 'auto-benefit', isActive: true }
          })
        }
      } as any;

      const res = await validateRegistrationCode(mockPrisma, 'ACME-2026');
      expect(res).toEqual({
        valid: true,
        companyId: 'comp-1',
        companyName: 'Acme Corp',
        programId: 'prog-1',
        programName: 'Auto Benefit'
      });
    });

    it('throws 404 when code does not exist or is inactive', async () => {
      const mockPrismaNotFound = {
        employeeRegistrationCode: { findUnique: vi.fn().mockResolvedValue(null) }
      } as any;

      await expect(validateRegistrationCode(mockPrismaNotFound, 'UNKNOWN-CODE')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Nieprawidłowy lub nieaktywny')
      });

      const mockPrismaInactive = {
        employeeRegistrationCode: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'c-1',
            isActive: false,
            expiresAt: null,
            company: { id: 'c1', name: 'C1', slug: 'c1', isActive: true },
            program: { id: 'p1', name: 'P1', slug: 'p1', isActive: true }
          })
        }
      } as any;

      await expect(validateRegistrationCode(mockPrismaInactive, 'INACTIVE-CODE')).rejects.toMatchObject({
        statusCode: 404
      });
    });

    it('throws 410 when code expiresAt <= now', async () => {
      const now = new Date();
      const mockPrismaExpired = {
        employeeRegistrationCode: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'c-1',
            isActive: true,
            expiresAt: new Date(now.getTime() - 1000),
            company: { id: 'c1', name: 'C1', slug: 'c1', isActive: true },
            program: { id: 'p1', name: 'P1', slug: 'p1', isActive: true }
          })
        }
      } as any;

      await expect(validateRegistrationCode(mockPrismaExpired, 'EXPIRED-CODE')).rejects.toMatchObject({
        statusCode: 410,
        message: expect.stringContaining('wygasł')
      });
    });

    it('throws 403 when company or program is inactive', async () => {
      const mockPrismaInactiveCompany = {
        employeeRegistrationCode: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'c-1',
            isActive: true,
            expiresAt: null,
            company: { id: 'c1', name: 'C1', slug: 'c1', isActive: false },
            program: { id: 'p1', name: 'P1', slug: 'p1', isActive: true }
          })
        }
      } as any;

      await expect(validateRegistrationCode(mockPrismaInactiveCompany, 'VALID-CODE')).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('nieaktywna')
      });

      const mockPrismaInactiveProgram = {
        employeeRegistrationCode: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'c-1',
            isActive: true,
            expiresAt: null,
            company: { id: 'c1', name: 'C1', slug: 'c1', isActive: true },
            program: { id: 'p1', name: 'P1', slug: 'p1', isActive: false }
          })
        }
      } as any;

      await expect(validateRegistrationCode(mockPrismaInactiveProgram, 'VALID-CODE')).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('nieaktywna')
      });
    });
  });

  describe('3. registerEmployeeWithCode', () => {
    it('validates input fields (email format, password utf-8 length, field limits)', async () => {
      const mockPrisma = {} as any;

      // Invalid email
      await expect(registerEmployeeWithCode(mockPrisma, {
        code: 'VALID-CODE',
        email: 'invalid-email-format',
        password: 'ValidPassword123!'
      })).rejects.toMatchObject({ statusCode: 400 });

      // Password < 8
      await expect(registerEmployeeWithCode(mockPrisma, {
        code: 'VALID-CODE',
        email: 'test@example.com',
        password: 'short'
      })).rejects.toMatchObject({ statusCode: 400 });

      // Password > 72 bytes (Bcrypt truncation limit defense)
      const longPass = 'ą'.repeat(37); // 37 * 2 bytes = 74 bytes
      await expect(registerEmployeeWithCode(mockPrisma, {
        code: 'VALID-CODE',
        email: 'test@example.com',
        password: longPass
      })).rejects.toMatchObject({ statusCode: 400 });

      // Overly long phone
      await expect(registerEmployeeWithCode(mockPrisma, {
        code: 'VALID-CODE',
        email: 'test@example.com',
        password: 'ValidPassword123!',
        phone: '1'.repeat(35)
      })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('fast-paths 409 if account already exists before transaction', async () => {
      const mockPrisma = {
        employeeAccount: {
          findUnique: vi.fn().mockResolvedValue({ id: 'existing-acc' })
        }
      } as any;

      await expect(registerEmployeeWithCode(mockPrisma, {
        code: 'CODE-123',
        email: 'existing@example.com',
        password: 'ValidPassword123!'
      })).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('już istnieje')
      });
    });

    it('executes Serializable transaction, creates account, membership, audit and returns real slugs', async () => {
      const mockTx = {
        employeeRegistrationCode: {
          findUnique: vi.fn().mockResolvedValue({
            companyId: 'comp-1',
            programId: 'prog-1',
            isActive: true,
            expiresAt: null,
            company: { id: 'comp-1', name: 'Acme Corp', slug: 'acme-corp', isActive: true },
            program: { id: 'prog-1', name: 'Acme Benefits', slug: 'acme-benefits', isActive: true }
          })
        },
        employeeAccount: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: 'acc-created-1',
            email: 'jan.kowalski@acme.com',
            firstName: 'Jan',
            lastName: 'Kowalski',
            phone: '+48 500 600 700',
            createdAt: new Date('2026-03-01T10:00:00.000Z')
          })
        },
        employeeMembership: {
          create: vi.fn().mockResolvedValue({ id: 'mem-1' })
        },
        employeeMembershipAudit: {
          create: vi.fn().mockResolvedValue({ id: 'audit-1' })
        }
      };

      const mockPrisma = {
        employeeAccount: {
          findUnique: vi.fn().mockResolvedValue(null)
        },
        employeeRegistrationCode: {
          findUnique: vi.fn().mockResolvedValue({
            companyId: 'comp-1',
            programId: 'prog-1',
            isActive: true,
            expiresAt: null,
            company: { id: 'comp-1', name: 'Acme Corp', slug: 'acme-corp', isActive: true },
            program: { id: 'prog-1', name: 'Acme Benefits', slug: 'acme-benefits', isActive: true }
          })
        },
        $transaction: vi.fn().mockImplementation(async (cb, opts) => {
          expect(opts?.isolationLevel).toBe('Serializable');
          return cb(mockTx);
        })
      } as any;

      const profile = await registerEmployeeWithCode(mockPrisma, {
        code: '  acme-2026  ',
        email: ' JAN.KOWALSKI@ACME.COM ',
        password: 'SuperPassword123!',
        firstName: ' Jan ',
        lastName: ' Kowalski ',
        phone: ' +48 500 600 700 '
      });

      expect(profile).toEqual({
        id: 'acc-created-1',
        email: 'jan.kowalski@acme.com',
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '+48 500 600 700',
        company: {
          id: 'comp-1',
          name: 'Acme Corp',
          slug: 'acme-corp'
        },
        program: {
          id: 'prog-1',
          name: 'Acme Benefits',
          slug: 'acme-benefits'
        },
        createdAt: '2026-03-01T10:00:00.000Z'
      });

      expect(mockTx.employeeMembership.create).toHaveBeenCalledWith({
        data: {
          accountId: 'acc-created-1',
          companyId: 'comp-1',
          programId: 'prog-1',
          isActive: true
        }
      });
      expect(mockTx.employeeMembershipAudit.create).toHaveBeenCalledWith({
        data: {
          accountId: 'acc-created-1',
          companyId: 'comp-1',
          programId: 'prog-1',
          action: 'CREATED',
          reason: 'Rejestracja kodem firmy'
        }
      });
    });

    it('retries on P2034 and succeeds on subsequent attempt', async () => {
      let attempts = 0;
      const mockPrisma = {
        employeeAccount: { findUnique: vi.fn().mockResolvedValue(null) },
        employeeRegistrationCode: {
          findUnique: vi.fn().mockResolvedValue({
            companyId: 'comp-1',
            programId: 'prog-1',
            isActive: true,
            expiresAt: null,
            company: { id: 'comp-1', name: 'Acme Corp', slug: 'acme-corp', isActive: true },
            program: { id: 'prog-1', name: 'Acme Benefits', slug: 'acme-benefits', isActive: true }
          })
        },
        $transaction: vi.fn().mockImplementation(async (cb) => {
          attempts++;
          if (attempts === 1) {
            const conflictErr: any = new Error('P2034 write conflict');
            conflictErr.code = 'P2034';
            throw conflictErr;
          }
          return {
            account: {
              id: 'acc-retry',
              email: 'retry@example.com',
              firstName: null,
              lastName: null,
              phone: null,
              createdAt: new Date('2026-01-01T00:00:00.000Z')
            },
            membership: {},
            company: { id: 'comp-1', name: 'Acme Corp', slug: 'acme-corp' },
            program: { id: 'prog-1', name: 'Acme Benefits', slug: 'acme-benefits' }
          };
        })
      } as any;

      const res = await registerEmployeeWithCode(mockPrisma, {
        code: 'VALID-CODE',
        email: 'retry@example.com',
        password: 'Password123!'
      });

      expect(attempts).toBe(2);
      expect(res.id).toBe('acc-retry');
    });

    it('maps Prisma P2002 unique constraint error to 409 Conflict', async () => {
      const mockPrisma = {
        employeeAccount: { findUnique: vi.fn().mockResolvedValue(null) },
        employeeRegistrationCode: {
          findUnique: vi.fn().mockResolvedValue({
            companyId: 'comp-1',
            programId: 'prog-1',
            isActive: true,
            expiresAt: null,
            company: { id: 'comp-1', name: 'Acme Corp', slug: 'acme-corp', isActive: true },
            program: { id: 'prog-1', name: 'Acme Benefits', slug: 'acme-benefits', isActive: true }
          })
        },
        $transaction: vi.fn().mockImplementation(async () => {
          const p2002Err: any = new Error('Unique constraint failed on the fields: (`email`)');
          p2002Err.code = 'P2002';
          throw p2002Err;
        })
      } as any;

      await expect(registerEmployeeWithCode(mockPrisma, {
        code: 'VALID-CODE',
        email: 'unique-fail@example.com',
        password: 'Password123!'
      })).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('już istnieje')
      });
    });
  });

  describe('4. authenticateEmployee', () => {
    it('successfully logs in with correct credentials and active accounts', async () => {
      const realPassword = 'MySecretPassword123!';
      const passwordHash = await bcrypt.hash(realPassword, 10);

      const mockPrisma = {
        employeeAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'emp-acc-1',
            email: 'employee@company.pl',
            passwordHash,
            firstName: 'Anna',
            lastName: 'Nowak',
            isActive: true,
            membership: {
              isActive: true,
              company: { id: 'comp-1', name: 'Company 1', slug: 'company-1', isActive: true },
              program: { id: 'prog-1', name: 'Program 1', slug: 'program-1', isActive: true }
            }
          }),
          update: vi.fn().mockResolvedValue({})
        }
      } as any;

      const result = await authenticateEmployee(mockPrisma, 'EMPLOYEE@company.pl', realPassword);

      expect(result.account.id).toBe('emp-acc-1');
      expect(result.account.email).toBe('employee@company.pl');
      expect(result.membership.companySlug).toBe('company-1');
      expect(mockPrisma.employeeAccount.update).toHaveBeenCalledWith({
        where: { id: 'emp-acc-1' },
        data: { lastLoginAt: expect.any(Date) }
      });
    });

    it('returns generic 401 when account does not exist or password does not match', async () => {
      const mockPrismaNotFound = {
        employeeAccount: { findUnique: vi.fn().mockResolvedValue(null) }
      } as any;

      await expect(authenticateEmployee(mockPrismaNotFound, 'unknown@example.com', 'Pass1234!')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Nieprawidłowy login lub hasło'
      });

      const hash = await bcrypt.hash('CorrectPass', 10);
      const mockPrismaWrongPass = {
        employeeAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'emp-1',
            email: 'user@example.com',
            passwordHash: hash,
            isActive: true,
            membership: {
              isActive: true,
              company: { id: 'c1', name: 'C1', slug: 'c1', isActive: true },
              program: { id: 'p1', name: 'P1', slug: 'p1', isActive: true }
            }
          })
        }
      } as any;

      await expect(authenticateEmployee(mockPrismaWrongPass, 'user@example.com', 'WrongPass')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Nieprawidłowy login lub hasło'
      });
    });

    it('does not reveal inactive account status during login to prevent enumeration (returns generic 401)', async () => {
      const realPassword = 'RealPassword123!';
      const hash = await bcrypt.hash(realPassword, 10);

      const mockPrismaInactiveAccount = {
        employeeAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'emp-inactive',
            email: 'inactive@example.com',
            passwordHash: hash,
            isActive: false, // Inactive account!
            membership: {
              isActive: true,
              company: { id: 'c1', name: 'C1', slug: 'c1', isActive: true },
              program: { id: 'p1', name: 'P1', slug: 'p1', isActive: true }
            }
          })
        }
      } as any;

      await expect(authenticateEmployee(mockPrismaInactiveAccount, 'inactive@example.com', realPassword)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Nieprawidłowy login lub hasło'
      });
    });

    it('throws 403 when membership, company or program is inactive', async () => {
      const pass = 'Password123!';
      const hash = await bcrypt.hash(pass, 10);

      // Inactive membership
      const mockPrismaInactiveMem = {
        employeeAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'emp-1',
            email: 'user@example.com',
            passwordHash: hash,
            isActive: true,
            membership: {
              isActive: false,
              company: { id: 'c1', name: 'C1', slug: 'c1', isActive: true },
              program: { id: 'p1', name: 'P1', slug: 'p1', isActive: true }
            }
          })
        }
      } as any;

      await expect(authenticateEmployee(mockPrismaInactiveMem, 'user@example.com', pass)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Brak aktywnego członkostwa')
      });

      // Inactive company/program
      const mockPrismaInactiveComp = {
        employeeAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'emp-1',
            email: 'user@example.com',
            passwordHash: hash,
            isActive: true,
            membership: {
              isActive: true,
              company: { id: 'c1', name: 'C1', slug: 'c1', isActive: false },
              program: { id: 'p1', name: 'P1', slug: 'p1', isActive: true }
            }
          })
        }
      } as any;

      await expect(authenticateEmployee(mockPrismaInactiveComp, 'user@example.com', pass)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('nieaktywne')
      });
    });
  });

  describe('5. getEmployeeProfile', () => {
    it('returns full profile when account, membership, company and program are active', async () => {
      const mockPrisma = {
        employeeAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'acc-123',
            email: 'jan@example.com',
            firstName: 'Jan',
            lastName: 'Nowak',
            phone: '+48 111 222 333',
            isActive: true,
            createdAt: new Date('2026-02-15T12:00:00.000Z'),
            membership: {
              isActive: true,
              company: { id: 'c-1', name: 'Acme Corp', slug: 'acme-corp', isActive: true },
              program: { id: 'p-1', name: 'Acme Fleet', slug: 'acme-fleet', isActive: true }
            }
          })
        }
      } as any;

      const profile = await getEmployeeProfile(mockPrisma, 'acc-123');
      expect(profile).toEqual({
        id: 'acc-123',
        email: 'jan@example.com',
        firstName: 'Jan',
        lastName: 'Nowak',
        phone: '+48 111 222 333',
        company: { id: 'c-1', name: 'Acme Corp', slug: 'acme-corp' },
        program: { id: 'p-1', name: 'Acme Fleet', slug: 'acme-fleet' },
        createdAt: '2026-02-15T12:00:00.000Z'
      });
    });

    it('rejects with 400 for invalid accountId input', async () => {
      const mockPrisma = {} as any;
      await expect(getEmployeeProfile(mockPrisma, '')).rejects.toMatchObject({ statusCode: 400 });
      await expect(getEmployeeProfile(mockPrisma, null as any)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects with 404 when account does not exist', async () => {
      const mockPrisma = {
        employeeAccount: { findUnique: vi.fn().mockResolvedValue(null) }
      } as any;

      await expect(getEmployeeProfile(mockPrisma, 'non-existing')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('rejects with 403 when account, membership, company or program is inactive', async () => {
      // Inactive account
      const mockPrismaInactiveAcc = {
        employeeAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'acc-1',
            email: 'jan@example.com',
            isActive: false,
            membership: {
              isActive: true,
              company: { id: 'c1', name: 'C1', slug: 'c1', isActive: true },
              program: { id: 'p1', name: 'P1', slug: 'p1', isActive: true }
            }
          })
        }
      } as any;

      await expect(getEmployeeProfile(mockPrismaInactiveAcc, 'acc-1')).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Konto pracownicze jest nieaktywne')
      });

      // Inactive company
      const mockPrismaInactiveComp = {
        employeeAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'acc-1',
            email: 'jan@example.com',
            isActive: true,
            membership: {
              isActive: true,
              company: { id: 'c1', name: 'C1', slug: 'c1', isActive: false },
              program: { id: 'p1', name: 'P1', slug: 'p1', isActive: true }
            }
          })
        }
      } as any;

      await expect(getEmployeeProfile(mockPrismaInactiveComp, 'acc-1')).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Firma pracodawcy powiązana z kontem jest nieaktywna')
      });

      // Inactive program
      const mockPrismaInactiveProg = {
        employeeAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'acc-1',
            email: 'jan@example.com',
            isActive: true,
            membership: {
              isActive: true,
              company: { id: 'c1', name: 'C1', slug: 'c1', isActive: true },
              program: { id: 'p1', name: 'P1', slug: 'p1', isActive: false }
            }
          })
        }
      } as any;

      await expect(getEmployeeProfile(mockPrismaInactiveProg, 'acc-1')).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Program pracowniczy powiązany z kontem jest nieaktywny')
      });
    });
  });
});
