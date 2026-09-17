import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import { Prisma } from '@prisma/client';
import { requirePermission } from '../../../middleware/permissions.js';
import { hashRegistrationCode } from '../auth/employee-auth.service.js';
import {
  detectCSVFormat,
  mapCSVRowToMatrixEntry,
  mapProviderCSVRow,
  type RentalMatrixCSVRow,
  type ProviderCSVRow
} from '../../../services/rental-csv-mapper.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function generateReadableCode(prefix: string = 'EP'): string {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // Unambiguous Crockford-style
  const bytes = crypto.randomBytes(8);
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[bytes[i] % chars.length];
  }
  for (let i = 4; i < 8; i++) {
    part2 += chars[bytes[i] % chars.length];
  }
  return `${prefix.toUpperCase()}-${part1}-${part2}`;
}

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional()
});

const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(150),
  nip: z.string().trim().max(20).optional().nullable(),
  accountManagerEmail: z.string().trim().email('Nieprawidłowy adres email opiekuna').optional().nullable(),
  programName: z.string().trim().min(2).max(150).optional(),
  defaultDiscountPct: z.coerce.number().min(0).max(100).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable()
});

const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  nip: z.string().trim().max(20).optional().nullable(),
  accountManagerEmail: z.string().trim().email('Nieprawidłowy adres email opiekuna').optional().nullable(),
  isActive: z.boolean().optional()
});

const updateProgramSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  defaultDiscountPct: z.coerce.number().min(0).max(100).optional().nullable(),
  scopeIncludeNew: z.boolean().optional(),
  scopeIncludeRental: z.boolean().optional(),
  scopeDiscountPct: z.coerce.number().min(0).max(100).optional().nullable(),
  isPubliclyListed: z.boolean().optional(),
  isActive: z.boolean().optional()
});

const createRegistrationCodeSchema = z.object({
  label: z.string().trim().max(100).optional().nullable(),
  customCode: z.string().trim().min(4).max(50).optional(),
  expiresAt: z.string().datetime().optional().nullable()
});

const createBenefitPolicySchema = z.object({
  name: z.string().trim().min(2).max(150),
  moyaCardAmount: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  fuelDiscount: z.string().trim().max(100).optional().nullable(),
  consultantCare: z.boolean().default(true),
  termsText: z.string().trim().max(2000).optional().nullable()
});

const updateBenefitPolicySchema = createBenefitPolicySchema.partial().extend({
  isActive: z.boolean().optional()
});

const createOfferSchema = z.object({
  sourceType: z.enum(['FINANCING', 'RENTAL']).optional().default('FINANCING'),
  listingId: z.string().optional().nullable(),
  assignmentId: z.string().optional().nullable(),
  customPricePln: z.coerce.number().int().min(1).optional().nullable(),
  discountPct: z.coerce.number().min(0).max(100).optional().nullable(),
  benefitPolicyId: z.string().optional().nullable(),
  isExcluded: z.boolean().optional().default(false)
}).superRefine((data, ctx) => {
  if (data.sourceType === 'RENTAL') {
    if (!data.assignmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assignmentId'],
        message: 'assignmentId jest wymagany dla oferty najmu'
      });
    }
  } else {
    if (!data.listingId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['listingId'],
        message: 'listingId jest wymagany dla oferty finansowania'
      });
    }
  }
});

const updateOfferSchema = z.object({
  customPricePln: z.coerce.number().int().min(1).optional().nullable(),
  discountPct: z.coerce.number().min(0).max(100).optional().nullable(),
  benefitPolicyId: z.string().optional().nullable(),
  isExcluded: z.boolean().optional(),
  isActive: z.boolean().optional()
});

const createMatrixSetSchema = z.object({
  rentalCompanyId: z.string().min(1),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500).optional().nullable()
});

const revokeMembershipSchema = z.object({
  reason: z.string().trim().min(3, 'Powód cofnięcia dostępu musi mieć co najmniej 3 znaki').max(500, 'Powód nie może przekraczać 500 znaków')
});

// ---------------------------------------------------------------------------
// Employee Admin Routes Plugin
// ---------------------------------------------------------------------------

export async function employeeAdminRoutes(fastify: FastifyInstance) {
  // Global admin security check for all endpoints in this plugin
  const authHandler = typeof fastify.authenticate === 'function'
    ? fastify.authenticate
    : async (_req: FastifyRequest, reply: FastifyReply) => {
        return reply.code(401).send({ error: 'Unauthorized' });
      };
  const adminAuth = [authHandler, requirePermission('platform:settings:write')];

  fastify.setErrorHandler((error: any, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Błąd walidacji danych wejściowych',
        details: error.errors
      });
    }
    const statusCode = typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;
    return reply.code(statusCode).send({
      error: error.name || 'Error',
      message: error.message || 'Wystąpił błąd serwera'
    });
  });

  // -------------------------------------------------------------------------
  // 1. Companies & Programs
  // -------------------------------------------------------------------------

  // GET /api/admin/employee-programs/companies
  fastify.get('/api/admin/employee-programs/companies', { preHandler: adminAuth }, async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeCompanyWhereInput = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { nip: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const [total, companies] = await Promise.all([
      fastify.prisma.employeeCompany.count({ where }),
      fastify.prisma.employeeCompany.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          programs: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
              defaultDiscountPct: true,
              scopeIncludeNew: true,
              scopeIncludeRental: true,
              scopeDiscountPct: true,
              _count: {
                select: {
                  registrationCodes: { where: { isActive: true } },
                  offers: { where: { isActive: true } },
                  memberships: { where: { isActive: true } }
                }
              }
            }
          },
          _count: {
            select: {
              registrationCodes: { where: { isActive: true } },
              memberships: { where: { isActive: true } }
            }
          }
        }
      })
    ]);

    return reply.send({
      companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  });

  // POST /api/admin/employee-programs/companies
  fastify.post('/api/admin/employee-programs/companies', { preHandler: adminAuth }, async (request, reply) => {
    const body = createCompanySchema.parse(request.body);
    const baseSlug = slugify(body.name);

    if (!baseSlug) {
      return reply.code(400).send({ error: 'Nazwa firmy musi zawierać poprawne znaki alfanumeryczne' });
    }

    // Check name uniqueness
    const existing = await fastify.prisma.employeeCompany.findUnique({
      where: { name: body.name }
    });
    if (existing) {
      return reply.code(409).send({ error: 'Firma o podanej nazwie już istnieje' });
    }

    // Generate unique slug
    let companySlug = baseSlug;
    let counter = 1;
    while (await fastify.prisma.employeeCompany.findUnique({ where: { slug: companySlug } })) {
      companySlug = `${baseSlug}-${counter++}`;
    }

    const programName = body.programName || `Program Samochodowy ${body.name}`;
    const programSlug = 'glowny';

    try {
      const company = await fastify.prisma.$transaction(async (tx) => {
        const createdCompany = await tx.employeeCompany.create({
          data: {
            name: body.name,
            slug: companySlug,
            nip: body.nip || null,
            accountManagerEmail: body.accountManagerEmail || null,
            isActive: true
          }
        });

        const createdProgram = await tx.employeeProgram.create({
          data: {
            companyId: createdCompany.id,
            name: programName,
            slug: programSlug,
            description: body.description || null,
            defaultDiscountPct: body.defaultDiscountPct != null ? new Prisma.Decimal(body.defaultDiscountPct) : null,
            isActive: true
          }
        });

        // Create default starter Moya benefit policy
        await tx.employeeBenefitPolicy.create({
          data: {
            programId: createdProgram.id,
            name: 'Pakiet Powitalny Moya + Doradca',
            moyaCardAmount: 500,
            fuelDiscount: '10 gr/l paliwa standard, 15 gr/l premium',
            consultantCare: true,
            termsText: 'Karta paliwowa Moya wydawana przy odbiorze pojazdu. Dedykowany doradca wspiera proces zamówienia i rejestracji.'
          }
        });

        return tx.employeeCompany.findUnique({
          where: { id: createdCompany.id },
          include: {
            programs: {
              include: {
                benefitPolicies: true
              }
            }
          }
        });
      });

      return reply.code(201).send({ company });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return reply.code(409).send({ error: 'Wystąpił konflikt unikalności nazwy lub identyfikatora firmy' });
      }
      fastify.log.error(err, 'Failed to create company and default program');
      return reply.code(500).send({ error: 'Nie udało się utworzyć firmy' });
    }
  });

  // GET /api/admin/employee-programs/companies/:companyId
  fastify.get('/api/admin/employee-programs/companies/:companyId', { preHandler: adminAuth }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };

    const company = await fastify.prisma.employeeCompany.findUnique({
      where: { id: companyId },
      include: {
        programs: {
          include: {
            benefitPolicies: true,
            _count: {
              select: {
                registrationCodes: true,
                offers: true,
                memberships: true
              }
            }
          }
        }
      }
    });

    if (!company) {
      return reply.code(404).send({ error: 'Firma nie została znaleziona' });
    }

    return reply.send({ company });
  });

  // PATCH /api/admin/employee-programs/companies/:companyId
  fastify.patch('/api/admin/employee-programs/companies/:companyId', { preHandler: adminAuth }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const body = updateCompanySchema.parse(request.body);

    try {
      const updated = await fastify.prisma.employeeCompany.update({
        where: { id: companyId },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.nip !== undefined && { nip: body.nip }),
          ...(body.accountManagerEmail !== undefined && { accountManagerEmail: body.accountManagerEmail }),
          ...(body.isActive !== undefined && { isActive: body.isActive })
        }
      });
      return reply.send({ company: updated });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return reply.code(409).send({ error: 'Firma o podanej nazwie już istnieje' });
      }
      if (err?.code === 'P2025') {
        return reply.code(404).send({ error: 'Firma nie została znaleziona' });
      }
      throw err;
    }
  });

  // GET /api/admin/employee-programs/companies/:companyId/accounts
  fastify.get('/api/admin/employee-programs/companies/:companyId/accounts', { preHandler: adminAuth }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const query = paginationSchema.parse(request.query);
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const company = await fastify.prisma.employeeCompany.findUnique({
      where: { id: companyId }
    });
    if (!company) {
      return reply.code(404).send({ error: 'Firma nie została znaleziona' });
    }

    const where: Prisma.EmployeeMembershipWhereInput = {
      companyId,
      ...(search ? {
        account: {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } }
          ]
        }
      } : {})
    };

    const [total, memberships] = await Promise.all([
      fastify.prisma.employeeMembership.count({ where }),
      fastify.prisma.employeeMembership.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          account: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
              lastLoginAt: true,
              createdAt: true
            }
          },
          program: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      })
    ]);

    const accounts = memberships.map((m) => ({
      id: m.account.id,
      membershipId: m.id,
      email: m.account.email,
      firstName: m.account.firstName,
      lastName: m.account.lastName,
      phone: m.account.phone,
      program: m.program,
      isActive: m.isActive && m.account.isActive && m.revokedAt === null,
      membershipIsActive: m.isActive,
      revokedAt: m.revokedAt ? m.revokedAt.toISOString() : null,
      lastLoginAt: m.account.lastLoginAt ? m.account.lastLoginAt.toISOString() : null,
      createdAt: m.account.createdAt.toISOString()
    }));

    return reply.send({
      accounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  });

  // POST /api/admin/employee-programs/memberships/:membershipId/revoke
  fastify.post('/api/admin/employee-programs/memberships/:membershipId/revoke', { preHandler: adminAuth }, async (request, reply) => {
    const { membershipId } = request.params as { membershipId: string };
    const { reason } = revokeMembershipSchema.parse(request.body);
    const actorUserId = (request as any).user?.userId || (request as any).user?.id || null;

    const membership = await fastify.prisma.employeeMembership.findUnique({
      where: { id: membershipId }
    });

    if (!membership) {
      return reply.code(404).send({ error: 'Członkostwo nie zostało znalezione' });
    }

    if (!membership.isActive && membership.revokedAt !== null) {
      return reply.send({ message: 'Dostęp został już wcześniej cofnięty', membership });
    }

    const now = new Date();
    const sessionsValidAfter = new Date(Math.floor(Date.now() / 1000) * 1000);

    const result = await fastify.prisma.$transaction(async (tx) => {
      const updatedMembership = await tx.employeeMembership.update({
        where: { id: membershipId },
        data: {
          isActive: false,
          revokedAt: now
        }
      });

      await tx.employeeMembershipAudit.create({
        data: {
          accountId: membership.accountId,
          companyId: membership.companyId,
          programId: membership.programId,
          action: 'REVOKED',
          reason,
          actorUserId
        }
      });

      await tx.employeeAccount.update({
        where: { id: membership.accountId },
        data: {
          sessionsValidAfter
        }
      });

      return updatedMembership;
    });

    return reply.send({ message: 'Dostęp został pomyślnie cofnięty', membership: result });
  });

  // POST /api/admin/employee-programs/memberships/:membershipId/reinstate
  fastify.post('/api/admin/employee-programs/memberships/:membershipId/reinstate', { preHandler: adminAuth }, async (request, reply) => {
    const { membershipId } = request.params as { membershipId: string };
    const actorUserId = (request as any).user?.userId || (request as any).user?.id || null;
    const reason = typeof (request.body as any)?.reason === 'string' ? (request.body as any).reason.trim() : null;

    const membership = await fastify.prisma.employeeMembership.findUnique({
      where: { id: membershipId }
    });

    if (!membership) {
      return reply.code(404).send({ error: 'Członkostwo nie zostało znalezione' });
    }

    if (membership.isActive && membership.revokedAt === null) {
      return reply.send({ message: 'Członkostwo jest już aktywne', membership });
    }

    const result = await fastify.prisma.$transaction(async (tx) => {
      const updatedMembership = await tx.employeeMembership.update({
        where: { id: membershipId },
        data: {
          isActive: true,
          revokedAt: null
        }
      });

      await tx.employeeMembershipAudit.create({
        data: {
          accountId: membership.accountId,
          companyId: membership.companyId,
          programId: membership.programId,
          action: 'REINSTATED',
          reason,
          actorUserId
        }
      });

      return updatedMembership;
    });

    return reply.send({ message: 'Dostęp został pomyślnie przywrócony', membership: result });
  });


  // PATCH /api/admin/employee-programs/programs/:programId
  fastify.patch('/api/admin/employee-programs/programs/:programId', { preHandler: adminAuth }, async (request, reply) => {
    const { programId } = request.params as { programId: string };
    const body = updateProgramSchema.parse(request.body);

    try {
      const updated = await fastify.prisma.employeeProgram.update({
        where: { id: programId },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.defaultDiscountPct !== undefined && {
            defaultDiscountPct: body.defaultDiscountPct != null ? new Prisma.Decimal(body.defaultDiscountPct) : null
          }),
          ...(body.scopeIncludeNew !== undefined && { scopeIncludeNew: body.scopeIncludeNew }),
          ...(body.scopeIncludeRental !== undefined && { scopeIncludeRental: body.scopeIncludeRental }),
          ...(body.scopeDiscountPct !== undefined && {
            scopeDiscountPct: body.scopeDiscountPct != null ? new Prisma.Decimal(body.scopeDiscountPct) : null
          }),
          ...(body.isPubliclyListed !== undefined && { isPubliclyListed: body.isPubliclyListed }),
          ...(body.isActive !== undefined && { isActive: body.isActive })
        }
      });
      return reply.send({ program: updated });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        return reply.code(404).send({ error: 'Program nie został znaleziony' });
      }
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // 2. Registration Codes
  // -------------------------------------------------------------------------

  // GET /api/admin/employee-programs/programs/:programId/registration-codes
  fastify.get('/api/admin/employee-programs/programs/:programId/registration-codes', { preHandler: adminAuth }, async (request, reply) => {
    const { programId } = request.params as { programId: string };
    const query = paginationSchema.parse(request.query);
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [total, codes] = await Promise.all([
      fastify.prisma.employeeRegistrationCode.count({ where: { programId } }),
      fastify.prisma.employeeRegistrationCode.findMany({
        where: { programId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          companyId: true,
          programId: true,
          label: true,
          isActive: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);

    return reply.send({
      codes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  });

  // POST /api/admin/employee-programs/programs/:programId/registration-codes
  fastify.post('/api/admin/employee-programs/programs/:programId/registration-codes', { preHandler: adminAuth }, async (request, reply) => {
    const { programId } = request.params as { programId: string };
    const body = createRegistrationCodeSchema.parse(request.body);

    const program = await fastify.prisma.employeeProgram.findUnique({
      where: { id: programId },
      include: { company: true }
    });

    if (!program) {
      return reply.code(404).send({ error: 'Program nie został znaleziony' });
    }

    // Determine plaintext code: either customCode provided or auto-generated
    let rawCode: string;
    if (body.customCode) {
      rawCode = body.customCode.toUpperCase();
    } else {
      const companyPrefix = program.company.slug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'MOT';
      rawCode = generateReadableCode(companyPrefix);
    }

    const codeHash = hashRegistrationCode(rawCode);

    // Check if code hash already exists
    const existing = await fastify.prisma.employeeRegistrationCode.findUnique({
      where: { codeHash }
    });
    if (existing) {
      return reply.code(409).send({ error: 'Taki kod rejestracyjny już istnieje w systemie. Użyj innego kodu.' });
    }

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const created = await fastify.prisma.employeeRegistrationCode.create({
      data: {
        companyId: program.companyId,
        programId: program.id,
        codeHash,
        label: body.label || null,
        expiresAt,
        isActive: true
      }
    });

    return reply.code(201).send({
      code: {
        id: created.id,
        label: created.label,
        expiresAt: created.expiresAt,
        isActive: created.isActive,
        createdAt: created.createdAt
      },
      rawCode // Returned strictly once upon creation!
    });
  });

  // PATCH /api/admin/employee-programs/registration-codes/:codeId/deactivate
  fastify.patch('/api/admin/employee-programs/registration-codes/:codeId/deactivate', { preHandler: adminAuth }, async (request, reply) => {
    const { codeId } = request.params as { codeId: string };

    try {
      const updated = await fastify.prisma.employeeRegistrationCode.update({
        where: { id: codeId },
        data: { isActive: false }
      });
      return reply.send({ code: updated });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        return reply.code(404).send({ error: 'Kod rejestracyjny nie został znaleziony' });
      }
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // 3. Benefit Policies
  // -------------------------------------------------------------------------

  // GET /api/admin/employee-programs/programs/:programId/benefit-policies
  fastify.get('/api/admin/employee-programs/programs/:programId/benefit-policies', { preHandler: adminAuth }, async (request, reply) => {
    const { programId } = request.params as { programId: string };

    const policies = await fastify.prisma.employeeBenefitPolicy.findMany({
      where: { programId },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ policies });
  });

  // POST /api/admin/employee-programs/programs/:programId/benefit-policies
  fastify.post('/api/admin/employee-programs/programs/:programId/benefit-policies', { preHandler: adminAuth }, async (request, reply) => {
    const { programId } = request.params as { programId: string };
    const body = createBenefitPolicySchema.parse(request.body);

    const program = await fastify.prisma.employeeProgram.findUnique({ where: { id: programId } });
    if (!program) {
      return reply.code(404).send({ error: 'Program nie został znaleziony' });
    }

    const created = await fastify.prisma.employeeBenefitPolicy.create({
      data: {
        programId,
        name: body.name,
        moyaCardAmount: body.moyaCardAmount || null,
        fuelDiscount: body.fuelDiscount || null,
        consultantCare: body.consultantCare,
        termsText: body.termsText || null,
        isActive: true
      }
    });

    return reply.code(201).send({ policy: created });
  });

  // PATCH /api/admin/employee-programs/benefit-policies/:policyId
  fastify.patch('/api/admin/employee-programs/benefit-policies/:policyId', { preHandler: adminAuth }, async (request, reply) => {
    const { policyId } = request.params as { policyId: string };
    const body = updateBenefitPolicySchema.parse(request.body);

    try {
      const updated = await fastify.prisma.employeeBenefitPolicy.update({
        where: { id: policyId },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.moyaCardAmount !== undefined && { moyaCardAmount: body.moyaCardAmount }),
          ...(body.fuelDiscount !== undefined && { fuelDiscount: body.fuelDiscount }),
          ...(body.consultantCare !== undefined && { consultantCare: body.consultantCare }),
          ...(body.termsText !== undefined && { termsText: body.termsText }),
          ...(body.isActive !== undefined && { isActive: body.isActive })
        }
      });
      return reply.send({ policy: updated });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        return reply.code(404).send({ error: 'Pakiet benefitów nie został znaleziony' });
      }
      throw err;
    }
  });

  // DELETE /api/admin/employee-programs/benefit-policies/:policyId
  fastify.delete('/api/admin/employee-programs/benefit-policies/:policyId', { preHandler: adminAuth }, async (request, reply) => {
    const { policyId } = request.params as { policyId: string };

    const attachedOffersCount = await fastify.prisma.employeeProgramOffer.count({
      where: { benefitPolicyId: policyId }
    });

    if (attachedOffersCount > 0) {
      return reply.code(409).send({
        error: `Nie można usunąć pakietu benefitów, ponieważ jest powiązany z ${attachedOffersCount} ofertami. Dezaktywuj pakiet lub zmień oferty.`
      });
    }

    try {
      await fastify.prisma.employeeBenefitPolicy.delete({ where: { id: policyId } });
      return reply.send({ success: true });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        return reply.code(404).send({ error: 'Pakiet benefitów nie został znaleziony' });
      }
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // 4. Special Offers & Available Listings
  // -------------------------------------------------------------------------

  // GET /api/admin/employee-programs/available-listings
  fastify.get('/api/admin/employee-programs/available-listings', { preHandler: adminAuth }, async (request, reply) => {
    const { programId, search, limit: rawLimit } = request.query as {
      programId: string;
      search?: string;
      limit?: string;
    };

    if (!programId) {
      return reply.code(400).send({ error: 'programId jest wymagany' });
    }

    const limit = Math.min(Math.max(parseInt(rawLimit || '20', 10), 1), 50);

    // Get list of listingIds already in this program
    const existingOffers = await fastify.prisma.employeeProgramOffer.findMany({
      where: { programId, listingId: { not: null } },
      select: { listingId: true }
    });
    const excludedIds = existingOffers.map((o) => o.listingId!).filter(Boolean);

    const where: Prisma.ListingWhereInput = {
      isArchived: false,
      ...(excludedIds.length > 0 ? { id: { notIn: excludedIds } } : {}),
      ...(search ? {
        OR: [
          { make: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          { version: { contains: search, mode: 'insensitive' } },
          { vin: { contains: search, mode: 'insensitive' } }
        ]
      } : {})
    };

    const listings = await fastify.prisma.listing.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        make: true,
        model: true,
        version: true,
        productionYear: true,
        pricePln: true,
        primaryImageUrl: true,
        imageUrls: true,
        fuelType: true,
        transmission: true,
        bodyType: true
      }
    });

    return reply.send({ listings });
  });

  // GET /api/admin/employee-programs/available-rental-assignments
  fastify.get('/api/admin/employee-programs/available-rental-assignments', { preHandler: adminAuth }, async (request, reply) => {
    const { programId, search, limit: rawLimit } = request.query as {
      programId: string;
      search?: string;
      limit?: string;
    };

    if (!programId) {
      return reply.code(400).send({ error: 'programId jest wymagany' });
    }

    const limit = Math.min(Math.max(parseInt(rawLimit || '50', 10), 1), 100);

    // Pobierz istniejące wykluczenia dla najmu w tym programie
    const existingOffers = await fastify.prisma.employeeProgramOffer.findMany({
      where: { programId, assignmentId: { not: null } },
      select: { assignmentId: true, isExcluded: true, isActive: true }
    });
    const excludedAssignmentIds = new Set(
      existingOffers
        .filter((o) => o.isExcluded && o.isActive)
        .map((o) => o.assignmentId!)
    );

    const where: Prisma.VehicleRentalAssignmentWhereInput = {
      isActive: true,
      vehicle: {
        isActive: true,
        isPublished: true,
        ...(search
          ? {
              OR: [
                { make: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
                { version: { contains: search, mode: 'insensitive' } }
              ]
            }
          : {})
      }
    };

    const assignments = await fastify.prisma.vehicleRentalAssignment.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            version: true,
            productionYear: true,
            primaryImageUrl: true,
            imageUrls: true,
            fuelType: true,
            transmission: true,
            bodyType: true
          }
        },
        rentalCompany: {
          select: {
            id: true,
            name: true,
            logoUrl: true
          }
        }
      }
    });

    const formattedAssignments = assignments.map((a) => ({
      id: a.id,
      vehicleId: a.vehicleId,
      rentalCompanyId: a.rentalCompanyId,
      isExcluded: excludedAssignmentIds.has(a.id),
      vehicle: a.vehicle,
      rentalCompany: a.rentalCompany
    }));

    return reply.send({ assignments: formattedAssignments });
  });

  // GET /api/admin/employee-programs/programs/:programId/offers
  fastify.get('/api/admin/employee-programs/programs/:programId/offers', { preHandler: adminAuth }, async (request, reply) => {
    const { programId } = request.params as { programId: string };
    const query = paginationSchema.parse(request.query);
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [total, offers] = await Promise.all([
      fastify.prisma.employeeProgramOffer.count({ where: { programId } }),
      fastify.prisma.employeeProgramOffer.findMany({
        where: { programId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: {
            select: {
              id: true,
              make: true,
              model: true,
              version: true,
              productionYear: true,
              pricePln: true,
              primaryImageUrl: true,
              imageUrls: true,
              fuelType: true,
              transmission: true
            }
          },
          assignment: {
            include: {
              vehicle: {
                select: {
                  id: true,
                  make: true,
                  model: true,
                  version: true,
                  productionYear: true,
                  primaryImageUrl: true,
                  imageUrls: true
                }
              },
              rentalCompany: {
                select: {
                  id: true,
                  name: true,
                  logoUrl: true
                }
              }
            }
          },
          benefitPolicy: {
            select: {
              id: true,
              name: true,
              moyaCardAmount: true,
              fuelDiscount: true,
              consultantCare: true
            }
          }
        }
      })
    ]);

    return reply.send({
      offers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  });

  // POST /api/admin/employee-programs/programs/:programId/offers
  fastify.post('/api/admin/employee-programs/programs/:programId/offers', { preHandler: adminAuth }, async (request, reply) => {
    const { programId } = request.params as { programId: string };
    const body = createOfferSchema.parse(request.body);

    const program = await fastify.prisma.employeeProgram.findUnique({ where: { id: programId } });
    if (!program) {
      return reply.code(404).send({ error: 'Program nie został znaleziony' });
    }

    if (body.sourceType === 'RENTAL') {
      const assignment = await fastify.prisma.vehicleRentalAssignment.findUnique({ where: { id: body.assignmentId! } });
      if (!assignment) {
        return reply.code(404).send({ error: 'Przypisanie najmu nie zostało znalezione' });
      }
    } else {
      const listing = await fastify.prisma.listing.findUnique({ where: { id: body.listingId! } });
      if (!listing) {
        return reply.code(404).send({ error: 'Pojazd nie został znaleziony' });
      }
    }

    // If benefitPolicyId is provided, verify it belongs to this program
    if (body.benefitPolicyId) {
      const policy = await fastify.prisma.employeeBenefitPolicy.findFirst({
        where: { id: body.benefitPolicyId, programId }
      });
      if (!policy) {
        return reply.code(400).send({ error: 'Wybrany pakiet benefitów nie należy do tego programu' });
      }
    }

    try {
      const offer = await fastify.prisma.employeeProgramOffer.create({
        data: {
          programId,
          sourceType: body.sourceType,
          listingId: body.sourceType === 'RENTAL' ? null : body.listingId,
          assignmentId: body.sourceType === 'RENTAL' ? body.assignmentId : null,
          customPricePln: body.customPricePln || null,
          discountPct: body.discountPct != null ? new Prisma.Decimal(body.discountPct) : null,
          benefitPolicyId: body.benefitPolicyId || null,
          isExcluded: body.isExcluded ?? false,
          isActive: true
        },
        include: {
          listing: true,
          assignment: {
            include: {
              vehicle: true,
              rentalCompany: true
            }
          },
          benefitPolicy: true
        }
      });
      return reply.code(201).send({ offer });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return reply.code(409).send({ error: 'Ten pojazd lub przypisanie jest już powiązane z tym programem' });
      }
      throw err;
    }
  });

  // PATCH /api/admin/employee-programs/offers/:offerId
  fastify.patch('/api/admin/employee-programs/offers/:offerId', { preHandler: adminAuth }, async (request, reply) => {
    const { offerId } = request.params as { offerId: string };
    const body = updateOfferSchema.parse(request.body);

    const existingOffer = await fastify.prisma.employeeProgramOffer.findUnique({
      where: { id: offerId }
    });
    if (!existingOffer) {
      return reply.code(404).send({ error: 'Oferta nie została znaleziona' });
    }

    if (body.benefitPolicyId) {
      const policy = await fastify.prisma.employeeBenefitPolicy.findFirst({
        where: { id: body.benefitPolicyId, programId: existingOffer.programId }
      });
      if (!policy) {
        return reply.code(400).send({ error: 'Wybrany pakiet benefitów nie należy do programu tej oferty' });
      }
    }

    const updated = await fastify.prisma.employeeProgramOffer.update({
      where: { id: offerId },
      data: {
        ...(body.customPricePln !== undefined && { customPricePln: body.customPricePln }),
        ...(body.discountPct !== undefined && {
          discountPct: body.discountPct != null ? new Prisma.Decimal(body.discountPct) : null
        }),
        ...(body.benefitPolicyId !== undefined && { benefitPolicyId: body.benefitPolicyId }),
        ...(body.isExcluded !== undefined && { isExcluded: body.isExcluded }),
        ...(body.isActive !== undefined && { isActive: body.isActive })
      },
      include: {
        listing: true,
        benefitPolicy: true
      }
    });

    return reply.send({ offer: updated });
  });

  // DELETE /api/admin/employee-programs/offers/:offerId
  fastify.delete('/api/admin/employee-programs/offers/:offerId', { preHandler: adminAuth }, async (request, reply) => {
    const { offerId } = request.params as { offerId: string };

    try {
      await fastify.prisma.employeeProgramOffer.delete({ where: { id: offerId } });
      return reply.send({ success: true });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        return reply.code(404).send({ error: 'Oferta nie została znaleziona' });
      }
      throw err;
    }
  });

  // -------------------------------------------------------------------------
  // 5. Private Rental Matrices (CSV Import & Versioning - ADR-03)
  // -------------------------------------------------------------------------

  // GET /api/admin/employee-programs/matrix-sets
  fastify.get('/api/admin/employee-programs/matrix-sets', { preHandler: adminAuth }, async (_request, reply) => {
    const sets = await fastify.prisma.employeeMatrixSet.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        rentalCompany: {
          select: { id: true, name: true }
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 5,
          select: {
            id: true,
            versionNumber: true,
            label: true,
            status: true,
            feePct: true,
            publishedAt: true,
            createdAt: true,
            _count: { select: { rows: true } }
          }
        }
      }
    });

    return reply.send({ matrixSets: sets });
  });

  // POST /api/admin/employee-programs/matrix-sets
  fastify.post('/api/admin/employee-programs/matrix-sets', { preHandler: adminAuth }, async (request, reply) => {
    const body = createMatrixSetSchema.parse(request.body);

    const rentalCompany = await fastify.prisma.rentalCompany.findUnique({
      where: { id: body.rentalCompanyId }
    });
    if (!rentalCompany) {
      return reply.code(404).send({ error: 'Firma najmowa (dostawca floty) nie została znaleziona' });
    }

    const matrixSet = await fastify.prisma.employeeMatrixSet.create({
      data: {
        rentalCompanyId: body.rentalCompanyId,
        name: body.name,
        description: body.description || null
      },
      include: {
        rentalCompany: true
      }
    });

    return reply.code(201).send({ matrixSet });
  });

  // GET /api/admin/employee-programs/programs/:programId/matrix-sets
  fastify.get('/api/admin/employee-programs/programs/:programId/matrix-sets', { preHandler: adminAuth }, async (request, reply) => {
    const { programId } = request.params as { programId: string };
    const program = await fastify.prisma.employeeProgram.findUnique({
      where: { id: programId }
    });
    if (!program) {
      return reply.code(404).send({ error: 'Program nie został znaleziony' });
    }
    const matrixSets = await fastify.prisma.employeeProgramMatrixSet.findMany({
      where: { programId },
      orderBy: { createdAt: 'desc' },
      include: {
        matrixSet: {
          include: {
            rentalCompany: { select: { id: true, name: true, logoUrl: true } },
            versions: {
              where: { status: 'PUBLISHED' },
              orderBy: { versionNumber: 'desc' },
              take: 1,
              select: {
                id: true,
                versionNumber: true,
                label: true,
                status: true,
                effectiveFrom: true,
                effectiveTo: true,
                publishedAt: true,
                _count: { select: { rows: true } }
              }
            }
          }
        }
      }
    });
    return reply.send({ matrixSets });
  });

  // POST /api/admin/employee-programs/programs/:programId/matrix-sets
  fastify.post('/api/admin/employee-programs/programs/:programId/matrix-sets', { preHandler: adminAuth }, async (request, reply) => {
    const { programId } = request.params as { programId: string };
    const { matrixSetId } = request.body as { matrixSetId: string };

    if (!matrixSetId) {
      return reply.code(400).send({ error: 'matrixSetId jest wymagany' });
    }

    const program = await fastify.prisma.employeeProgram.findUnique({
      where: { id: programId }
    });
    if (!program) {
      return reply.code(404).send({ error: 'Program nie został znaleziony' });
    }

    const matrixSet = await fastify.prisma.employeeMatrixSet.findUnique({
      where: { id: matrixSetId }
    });
    if (!matrixSet) {
      return reply.code(404).send({ error: 'Zestaw matryc nie został znaleziony' });
    }

    // Egzekwowanie reguły biznesowej: max 1 zestaw per firma najmowa per program
    const existingSameCompany = await fastify.prisma.employeeProgramMatrixSet.findFirst({
      where: {
        programId,
        matrixSet: {
          rentalCompanyId: matrixSet.rentalCompanyId
        }
      }
    });

    if (existingSameCompany) {
      return reply.code(409).send({
        error: 'Conflict',
        message: 'Program posiada już powiązany zestaw matryc dla tego dostawcy floty'
      });
    }

    const link = await fastify.prisma.employeeProgramMatrixSet.create({
      data: {
        programId,
        matrixSetId
      },
      include: {
        matrixSet: {
          include: {
            rentalCompany: true
          }
        }
      }
    });

    return reply.code(201).send({ link });
  });

  // DELETE /api/admin/employee-programs/programs/:programId/matrix-sets/:matrixSetId
  fastify.delete('/api/admin/employee-programs/programs/:programId/matrix-sets/:matrixSetId', { preHandler: adminAuth }, async (request, reply) => {
    const { programId, matrixSetId } = request.params as { programId: string; matrixSetId: string };

    const deleted = await fastify.prisma.employeeProgramMatrixSet.deleteMany({
      where: { programId, matrixSetId }
    });

    if (deleted.count === 0) {
      return reply.code(404).send({ error: 'Powiązanie nie zostało znalezione' });
    }

    return reply.send({ success: true });
  });

  // POST /api/admin/employee-programs/matrix-sets/:setId/import
  fastify.post('/api/admin/employee-programs/matrix-sets/:setId/import', { preHandler: adminAuth }, async (request, reply) => {
    const { setId } = request.params as { setId: string };
    const { label } = request.query as { label?: string };

    const matrixSet = await fastify.prisma.employeeMatrixSet.findUnique({
      where: { id: setId },
      include: { rentalCompany: true }
    });

    if (!matrixSet) {
      return reply.code(404).send({ error: 'Zestaw matrycy nie został znaleziony' });
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'Nie przesłano pliku CSV' });
    }

    const buffer = await data.toBuffer();
    let csvContent = buffer.toString('utf-8');
    if (csvContent.charCodeAt(0) === 0xFEFF) csvContent = csvContent.slice(1);
    csvContent = csvContent.replace(/\r\r\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const headerLine = csvContent.split('\n')[0] || '';
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semiCount = (headerLine.match(/;/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;
    const detectedDelimiter = tabCount >= commaCount && tabCount >= semiCount ? '\t'
      : semiCount > commaCount ? ';' : ',';

    let records: Record<string, string>[];
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        delimiter: detectedDelimiter,
        relax_column_count: true,
        trim: true,
        bom: true
      }) as Record<string, string>[];
    } catch (err: any) {
      return reply.code(400).send({
        error: 'Błąd parsowania pliku CSV',
        message: err instanceof Error ? err.message : 'Nieprawidłowy format'
      });
    }

    if (records.length === 0) {
      return reply.code(400).send({ error: 'Plik CSV jest pusty' });
    }

    const headers = Object.keys(records[0]);
    const formatDetection = detectCSVFormat(headers);
    if (!formatDetection.format) {
      return reply.code(400).send({
        error: 'Nierozpoznany format kolumn CSV',
        missing: formatDetection.missing
      });
    }

    // Determine next version number
    const lastVersion = await fastify.prisma.employeeMatrixVersion.findFirst({
      where: { matrixSetId: setId },
      orderBy: { versionNumber: 'desc' }
    });
    const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;

    // Load existing assignments for this rental company to link matrix rows
    const assignments = await fastify.prisma.vehicleRentalAssignment.findMany({
      where: { rentalCompanyId: matrixSet.rentalCompanyId },
      include: { vehicle: true }
    });

    const assignmentByVehicleId = new Map<string, string>();
    for (const a of assignments) {
      if (a.vehicle?.id) assignmentByVehicleId.set(a.vehicle.id, a.id);
    }

    const versionLabel = label?.trim() || `Wersja ${nextVersionNumber} (${new Date().toLocaleDateString('pl-PL')})`;

    // Map records into candidate rows
    const rowsToInsert: Prisma.EmployeeMatrixRowCreateManyVersionInput[] = [];
    let skipped = 0;

    for (let i = 0; i < records.length; i++) {
      const rawRow = records[i];
      const rowEntries: any[] = [];

      if (formatDetection.format === 'internal') {
        const mapped = mapCSVRowToMatrixEntry(rawRow as unknown as RentalMatrixCSVRow, i + 2);
        if (!mapped.error && mapped.data) {
          rowEntries.push(mapped.data);
        }
      } else {
        const mapped = mapProviderCSVRow(rawRow as unknown as ProviderCSVRow, i + 2);
        if (!mapped.error && mapped.entries) {
          rowEntries.push(...mapped.entries);
        }
      }

      if (rowEntries.length === 0) {
        skipped++;
        continue;
      }

      for (const entry of rowEntries) {
        const vehicleId = entry.vehicleId;
        const assignmentId = assignmentByVehicleId.get(vehicleId);

        if (!assignmentId) {
          skipped++;
          continue;
        }

        rowsToInsert.push({
          assignmentId,
          contractMonths: entry.contractMonths,
          annualMileageKm: entry.annualMileageKm,
          initialPaymentPct: new Prisma.Decimal(entry.initialPaymentPct),
          initialPaymentAmountNet: new Prisma.Decimal(entry.initialPaymentAmountNet || 0),
          monthlyRateNet: new Prisma.Decimal(entry.monthlyRateNet),
          monthlyRateGross: new Prisma.Decimal(entry.monthlyRateGross),
          servicesIncluded: entry.servicesIncluded || [],
          insuranceExcess500: entry.insuranceExcess500 != null ? new Prisma.Decimal(entry.insuranceExcess500) : null,
          insuranceNoLimit: entry.insuranceNoLimit != null ? new Prisma.Decimal(entry.insuranceNoLimit) : null,
          tiresNoLimit: entry.tiresNoLimit != null ? new Prisma.Decimal(entry.tiresNoLimit) : null,
          overMileageCost: entry.overMileageCost != null ? new Prisma.Decimal(entry.overMileageCost) : null
        });
      }
    }

    if (rowsToInsert.length === 0) {
      return reply.code(400).send({
        error: `Żaden z wierszy CSV nie mógł zostać powiązany z pojazdami dostawcy ${matrixSet.rentalCompany.name}. Upewnij się, że identyfikatory pojazdów zgadzają się z bazą.`,
        totalRows: records.length,
        skipped
      });
    }

    // Create DRAFT version and bulk insert rows in transaction
    const createdVersion = await fastify.prisma.$transaction(async (tx) => {
      const version = await tx.employeeMatrixVersion.create({
        data: {
          matrixSetId: setId,
          versionNumber: nextVersionNumber,
          label: versionLabel,
          status: 'DRAFT'
        }
      });

      // Deduplicate rows based on unique constraint
      const seen = new Set<string>();
      const dedupedRows = rowsToInsert.filter((r) => {
        const netAmountStr = r.initialPaymentAmountNet ? r.initialPaymentAmountNet.toString() : '0';
        const key = `${r.assignmentId}-${r.contractMonths}-${r.annualMileageKm}-${r.initialPaymentPct.toString()}-${netAmountStr}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      await tx.employeeMatrixRow.createMany({
        data: dedupedRows.map((r) => ({
          ...r,
          versionId: version.id
        }))
      });

      return tx.employeeMatrixVersion.findUnique({
        where: { id: version.id },
        include: {
          _count: { select: { rows: true } }
        }
      });
    });

    return reply.code(201).send({
      version: createdVersion,
      totalRowsInCSV: records.length,
      rowsInserted: rowsToInsert.length,
      rowsSkipped: skipped
    });
  });

  // POST /api/admin/employee-programs/matrix-versions/:versionId/publish
  fastify.post('/api/admin/employee-programs/matrix-versions/:versionId/publish', { preHandler: adminAuth }, async (request, reply) => {
    const { versionId } = request.params as { versionId: string };

    const version = await fastify.prisma.employeeMatrixVersion.findUnique({
      where: { id: versionId },
      include: {
        matrixSet: true,
        _count: { select: { rows: true } }
      }
    });

    if (!version) {
      return reply.code(404).send({ error: 'Wersja matrycy nie została znaleziona' });
    }

    if (version._count.rows === 0) {
      return reply.code(400).send({ error: 'Nie można opublikować pustej matrycy bez wierszy kalkulacji' });
    }

    // Publish this version and archive previous published versions of the same set
    const updated = await fastify.prisma.$transaction(async (tx) => {
      await tx.employeeMatrixVersion.updateMany({
        where: {
          matrixSetId: version.matrixSetId,
          status: 'PUBLISHED',
          id: { not: versionId }
        },
        data: { status: 'ARCHIVED' }
      });

      return tx.employeeMatrixVersion.update({
        where: { id: versionId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date()
        },
        include: {
          _count: { select: { rows: true } }
        }
      });
    });

    return reply.send({ version: updated });
  });

  // GET /api/admin/employee-programs/matrix-versions/:versionId/preview
  fastify.get('/api/admin/employee-programs/matrix-versions/:versionId/preview', { preHandler: adminAuth }, async (request, reply) => {
    const { versionId } = request.params as { versionId: string };

    const version = await fastify.prisma.employeeMatrixVersion.findUnique({
      where: { id: versionId },
      include: {
        matrixSet: {
          include: { rentalCompany: true }
        },
        _count: { select: { rows: true } }
      }
    });

    if (!version) {
      return reply.code(404).send({ error: 'Wersja matrycy nie została znaleziona' });
    }

    const rowsSample = await fastify.prisma.employeeMatrixRow.findMany({
      where: { versionId },
      take: 25,
      orderBy: { createdAt: 'asc' },
      include: {
        assignment: {
          include: { vehicle: true }
        }
      }
    });

    return reply.send({
      version,
      sampleRows: rowsSample
    });
  });
}
