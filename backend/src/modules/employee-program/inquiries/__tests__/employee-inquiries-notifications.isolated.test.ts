import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { employeeInquiriesRoutes } from '../employee-inquiries.routes.js';
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  generateSignedCsrfToken,
  CSRF_HEADER_NAME
} from '../../auth/employee-session.helpers.js';
import * as emailService from '../../../../services/email.js';

describe('Employee Inquiries Email Notifications', () => {
  let app: FastifyInstance;
  let sentMails: any[];
  let shouldFailSmtp = false;

  const mockEmployee = {
    accountId: 'acc_notif_1',
    companyId: 'comp_notif_1',
    programId: 'prog_notif_1',
    email: 'pracownik@acme.com',
    company: {
      id: 'comp_notif_1',
      name: 'Acme Corporation Sp. z o.o.',
      accountManagerEmail: 'opiekun.acme@motolia.pl'
    },
    program: {
      id: 'prog_notif_1',
      name: 'Program Partnerski Acme'
    }
  };

  const mockOffer = {
    id: 'cuid_offer_notif_1',
    programId: 'prog_notif_1',
    sourceType: 'FINANCING',
    listingId: 'listing_notif_1',
    customPricePln: 95000,
    discountPct: '5.0',
    isActive: true,
    isExcluded: false,
    listing: {
      id: 'listing_notif_1',
      make: 'Toyota',
      model: 'Corolla',
      version: 'Comfort 1.8 Hybrid',
      productionYear: 2024,
      pricePln: 100000,
      isArchived: false,
      primaryImageUrl: 'https://img.test/car.jpg'
    },
    program: {
      id: 'prog_notif_1',
      name: 'Program Partnerski Acme',
      defaultDiscountPct: '5.0',
      company: {
        id: 'comp_notif_1',
        name: 'Acme Corporation Sp. z o.o.'
      }
    },
    benefitPolicy: {
      id: 'pol_1',
      name: 'Pakiet Paliwowy Moya',
      moyaCardAmount: 500,
      fuelDiscount: '10 gr/l',
      consultantCare: true,
      termsText: 'Karta paliwowa przy odbiorze'
    }
  };

  let inquiriesDb: Map<string, any>;
  let leadsDb: Map<string, any>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    sentMails = [];
    shouldFailSmtp = false;
    inquiriesDb = new Map();
    leadsDb = new Map();

    // Spy on email functions
    vi.spyOn(emailService, 'sendEmployeeInquiryNotificationEmail').mockImplementation(
      async (fastify, inquiry, company, recipientEmail) => {
        if (shouldFailSmtp) {
          throw new Error('SMTP Connection Failed: mock error');
        }
        sentMails.push({ type: 'manager', inquiry, company, recipientEmail });
      }
    );

    vi.spyOn(emailService, 'sendEmployeeInquiryConfirmationEmail').mockImplementation(
      async (fastify, inquiry, recipientEmail) => {
        if (shouldFailSmtp) {
          throw new Error('SMTP Connection Failed: mock error');
        }
        sentMails.push({ type: 'employee', inquiry, recipientEmail });
      }
    );

    const fakePrisma = {
      appSettings: {
        findFirst: async () => ({
          id: 'default',
          smtpHost: 'smtp.test',
          smtpPort: 587,
          smtpUser: 'user',
          smtpPassword: 'pass',
          smtpRecipientEmail: 'default-leads@motolia.pl'
        })
      },
      user: {
        findUnique: async () => null
      },
      employeeInquiry: {
        findUnique: async ({ where }: any) => {
          if (where.idempotencyKey) {
            return inquiriesDb.get(where.idempotencyKey) || null;
          }
          return null;
        },
        create: async ({ data, include }: any) => {
          const record = {
            id: `inq_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            lead: leadsDb.get(data.leadId) || { referenceNumber: 'PP-202609-0001' },
            company: mockEmployee.company,
            program: mockEmployee.program
          };
          inquiriesDb.set(data.idempotencyKey, record);
          return record;
        }
      },
      employeeProgramOffer: {
        findFirst: async () => mockOffer,
        findUnique: async () => mockOffer
      },
      employeeProductOverride: {
        findMany: async () => []
      },
      lead: {
        create: async ({ data }: any) => {
          const record = {
            id: `lead_${Date.now()}`,
            ...data,
            referenceNumber: 'PP-202609-0001',
            createdAt: new Date()
          };
          leadsDb.set(record.id, record);
          return record;
        }
      },
      employeeAccount: {
        findUnique: async () => ({
          id: mockEmployee.accountId,
          email: mockEmployee.email,
          isActive: true,
          sessionsValidAfter: null,
          membership: {
            isActive: true,
            revokedAt: null,
            companyId: mockEmployee.companyId,
            programId: mockEmployee.programId,
            company: { id: mockEmployee.companyId, name: mockEmployee.company.name, isActive: true },
            program: { id: mockEmployee.programId, name: mockEmployee.program.name, isActive: true }
          }
        })
      },
      $transaction: async (cb: any) => {
        return cb(fakePrisma);
      }
    };

    const fakeRedisStore = new Map<string, string>();
    const fakeRedis = {
      get: async (key: string) => fakeRedisStore.get(key) || null,
      set: async (key: string, val: string) => {
        fakeRedisStore.set(key, val);
        return 'OK';
      },
      del: async (key: string) => {
        fakeRedisStore.delete(key);
        return 1;
      }
    };

    app = Fastify();
    await app.register(fastifyJwt, { secret: 'test-super-secret-key-1234567890123' });
    app.setErrorHandler((error, req, reply) => {
      console.error('TEST CAUGHT ERROR:', error);
      reply.code(500).send({ error: error.message });
    });
    app.decorate('prisma', fakePrisma);
    app.decorate('redis', fakeRedis);

    await app.register(employeeInquiriesRoutes);
    await app.ready();
  });

  const generateAuthHeaders = (jti = '11111111-2222-4333-8444-555555555555') => {
    const issuedAt = Math.floor(Date.now() / 1000);
    const sessionToken = app.jwt.sign({
      sub: mockEmployee.accountId,
      accountId: mockEmployee.accountId,
      email: mockEmployee.email,
      companyId: mockEmployee.companyId,
      programId: mockEmployee.programId,
      membershipId: 'mem_1',
      realm: 'employee',
      aud: 'employee-portal',
      jti,
      iat: issuedAt,
      exp: issuedAt + 3600
    });

    // Save session in redis
    (app as any).redis.set(`ep:session:${jti}`, JSON.stringify({
      accountId: mockEmployee.accountId,
      companyId: mockEmployee.companyId,
      programId: mockEmployee.programId,
      membershipId: 'mem_1',
      createdAt: new Date()
    }));

    const csrfToken = generateSignedCsrfToken(app.jwt);

    return {
      host: 'pracownicy.test',
      origin: 'https://pracownicy.test',
      cookie: `${SESSION_COOKIE_NAME}=${sessionToken}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
      [CSRF_HEADER_NAME]: csrfToken
    };
  };

  it('sends both manager notification and employee confirmation emails on new inquiry', async () => {
    const headers = generateAuthHeaders('11111111-1111-4111-8111-111111111111');
    const payload = {
      offerId: mockOffer.id,
      idempotencyKey: 'a1111111-1111-4111-8111-111111111111',
      contractParty: 'CONSUMER',
      contactName: 'Adam Nowak',
      contactEmail: 'adam.nowak@acme.com',
      contactPhone: '+48123456789',
      consentPrivacy: true,
      notes: 'Proszę o kontakt w godzinach porannych'
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers,
      payload
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.inquiry.id).toBeDefined();

    // Give background fire-and-forget task a tick to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sentMails).toHaveLength(2);

    const managerMail = sentMails.find((m) => m.type === 'manager');
    const employeeMail = sentMails.find((m) => m.type === 'employee');

    expect(managerMail).toBeDefined();
    expect(managerMail.recipientEmail).toBe('opiekun.acme@motolia.pl');
    expect(managerMail.company.name).toBe('Acme Corporation Sp. z o.o.');

    expect(employeeMail).toBeDefined();
    expect(employeeMail.recipientEmail).toBe('adam.nowak@acme.com');
  });

  it('does not send duplicate emails on idempotent replay', async () => {
    const headers = generateAuthHeaders('22222222-2222-4222-8222-222222222222');
    const payload = {
      offerId: mockOffer.id,
      idempotencyKey: 'b2222222-2222-4222-8222-222222222222',
      contractParty: 'CONSUMER',
      contactName: 'Adam Nowak',
      contactEmail: 'adam.nowak@acme.com',
      contactPhone: '+48123456789',
      consentPrivacy: true
    };

    // First request - new inquiry
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers,
      payload
    });
    expect(res1.statusCode).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sentMails).toHaveLength(2);

    // Second request - identical idempotency key replay
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers,
      payload
    });
    expect(res2.statusCode).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Email count remains 2 (no duplicate mails triggered)
    expect(sentMails).toHaveLength(2);
  });

  it('does not fail or delete the 201 inquiry if SMTP dispatch throws an error', async () => {
    shouldFailSmtp = true;
    const headers = generateAuthHeaders('33333333-3333-4333-8333-333333333333');
    const payload = {
      offerId: mockOffer.id,
      idempotencyKey: 'c3333333-3333-4333-8333-333333333333',
      contractParty: 'CONSUMER',
      contactName: 'Adam Nowak',
      contactEmail: 'adam.nowak@acme.com',
      contactPhone: '+48123456789',
      consentPrivacy: true
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/employee/inquiries',
      headers,
      payload
    });

    // Inquiry created successfully despite SMTP error
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.inquiry.id).toBeDefined();

    // Verify record exists in DB
    expect(inquiriesDb.has('c3333333-3333-4333-8333-333333333333')).toBe(true);
  });

  it('verifies that sendEmployeeInquiryConfirmationEmail template does not contain supplier name or fee', async () => {
    // Test the actual email template generation
    const mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({ messageId: 'msg_1' })
    };
    vi.spyOn(emailService, 'sendEmployeeInquiryConfirmationEmail').mockRestore();

    // Mock nodemailer
    const nodemailer = await import('nodemailer');
    vi.spyOn(nodemailer.default, 'createTransport').mockReturnValue(mockTransporter as any);

    const rentalInquiry = {
      id: 'inq_rent_1',
      lead: { referenceNumber: 'PP-RENT-001' },
      contractParty: 'EMPLOYEE_B2B',
      contactName: 'Piotr Wiśniewski',
      contactEmail: 'piotr@firma.pl',
      contactPhone: '+48987654321',
      nip: '5213849201',
      notes: 'Wewnętrzna notatka',
      calculationSnapshot: {
        sourceType: 'RENTAL',
        vehicle: {
          make: 'Audi',
          model: 'A4',
          version: 'S-Line 40 TFSI',
          productionYear: 2024
        },
        rental: {
          rentalCompanyName: 'SekretnyDostawcaFlotowy sp. z o.o.', // GITLEAKS:ALLOW
          monthlyRateNet: 2500,
          monthlyRateGross: 3075,
          periodMonths: 36,
          annualMileageKm: 20000,
          initialPaymentAmountNet: 0
        }
      }
    };

    await emailService.sendEmployeeInquiryConfirmationEmail(
      app,
      rentalInquiry,
      'piotr@firma.pl',
      'Program Partnerski'
    );

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    const sentHtml: string = mockTransporter.sendMail.mock.calls[0][0].html;

    // Must contain vehicle and reference
    expect(sentHtml).toContain('PP-RENT-001');
    expect(sentHtml).toContain('Audi');
    expect(sentHtml).toContain('3075 zł brutto');

    // STRICTLY MUST NOT contain supplier name or internal details
    expect(sentHtml).not.toContain('SekretnyDostawcaFlotowy'); // GITLEAKS:ALLOW
    expect(sentHtml).not.toContain('5213849201'); // NIP should not be in confirmation to employee
    expect(sentHtml).not.toContain('Wewnętrzna notatka'); // Notes should not be in confirmation to employee
  });
});
