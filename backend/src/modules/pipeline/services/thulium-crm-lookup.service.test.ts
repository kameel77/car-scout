import { describe, expect, it, vi } from 'vitest';
import { lookupCustomerByPhone } from './thulium-crm-lookup.service.js';

const customer = {
  id: 'customer_456',
  fullName: 'Jan Kowalski',
  phone: '+48523993855',
  email: 'jan@example.com',
  companyNip: null as string | null,
  updatedAt: new Date('2026-01-01'),
};

const fullOpportunity = {
  id: 'opp_982',
  number: 'MTL-2026-00042',
  phase: 'FINANCIAL_DECISION',
  owner: { name: 'Anna Doradca', email: 'anna@motolia.pl' },
  vehicleCandidates: [
    {
      customMake: null,
      customModel: null,
      customYear: null,
      listing: { make: 'Toyota', model: 'Corolla', productionYear: 2023 },
      rentalVehicle: null,
    },
  ],
  offers: [{ monthlyRateGrosze: 201100 }],
  applications: [
    {
      roundNumber: 2,
      state: 'FULL_SUBMITTED',
      financier: { name: 'mBank' },
    },
  ],
  documents: [
    // Kody są techniczne, etykiety ludzkie — konsultant w Thulium ma widzieć etykietę.
    { code: 'ID_DOCUMENT', status: 'REQUIRED', requirement: { isMandatory: true, label: 'Dowód osobisty' } },
    { code: 'EMPLOYMENT_CONTRACT', status: 'RECEIVED', requirement: { isMandatory: true, label: 'Umowa o pracę' } },
    { code: 'EXTRA_ATTACHMENT', status: 'REQUIRED', requirement: { isMandatory: false, label: 'Opcjonalny załącznik' } },
  ],
};

function createPrisma(overrides: Record<string, unknown> = {}) {
  return {
    pipelineCustomer: {
      findFirst: vi.fn().mockResolvedValue(customer),
    },
    pipelineOpportunity: {
      findFirst: vi.fn().mockResolvedValue(fullOpportunity),
      count: vi.fn().mockResolvedValue(1),
    },
    ...overrides,
  } as any;
}

describe('lookupCustomerByPhone', () => {
  it.each(['523993855', '+48 523 993 855'])(
    'normalizes %s to the same phone query',
    async (input) => {
      const prisma = createPrisma();

      await lookupCustomerByPhone(prisma, input);

      expect(prisma.pipelineCustomer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { phone: '+48523993855' } })
      );
    }
  );

  it('returns null for an unknown customer', async () => {
    const prisma = createPrisma({
      pipelineCustomer: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    const result = await lookupCustomerByPhone(prisma, '523993855');

    expect(result).toBeNull();
  });

  it('returns null without querying the database for an unmatchable phone', async () => {
    const prisma = createPrisma();

    const result = await lookupCustomerByPhone(prisma, '000000000');

    expect(result).toBeNull();
    expect(prisma.pipelineCustomer.findFirst).not.toHaveBeenCalled();
  });

  it('produces the expected custom_fields for a full case', async () => {
    const prisma = createPrisma();

    const result = await lookupCustomerByPhone(prisma, '523993855');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Jan');
    expect(result?.surname).toBe('Kowalski');
    expect(result?.phone_number).toEqual(['+48523993855']);
    expect(result?.identifier).toBe('MTL-2026-00042');
    expect(result?.custom_fields['Sprawa']).toBe('MTL-2026-00042 — Decyzja finansowa');
    expect(result?.custom_fields['Status wniosku']).toBe('mBank — pełny wniosek w analizie (runda 2)');
    expect(result?.custom_fields['Pojazd']).toBe('Toyota Corolla 2023');
    expect(result?.custom_fields['Rata']).toBe('2 011 zł/mies.');
    expect(result?.custom_fields['Brakujące dokumenty']).toBe('Dowód osobisty');
    expect(result?.custom_fields['Doradca']).toBe('Anna Doradca');
    expect(result?.custom_fields['Link do sprawy']).toBe('https://motolia.pl/admin/pipeline?opp=opp_982');
    expect(result?.custom_fields['Otwarte sprawy']).toBeUndefined();
  });

  it('reports "brak wniosku" when the case has no applications', async () => {
    const prisma = createPrisma({
      pipelineOpportunity: {
        findFirst: vi.fn().mockResolvedValue({ ...fullOpportunity, applications: [] }),
        count: vi.fn().mockResolvedValue(1),
      },
    });

    const result = await lookupCustomerByPhone(prisma, '523993855');

    expect(result?.custom_fields['Status wniosku']).toBe('brak wniosku');
  });

  it('reports "komplet" when no mandatory documents are missing', async () => {
    const prisma = createPrisma({
      pipelineOpportunity: {
        findFirst: vi.fn().mockResolvedValue({
          ...fullOpportunity,
          documents: [
            { code: 'ID_DOCUMENT', status: 'RECEIVED', requirement: { isMandatory: true, label: 'Dowód osobisty' } },
          ],
        }),
        count: vi.fn().mockResolvedValue(1),
      },
    });

    const result = await lookupCustomerByPhone(prisma, '523993855');

    expect(result?.custom_fields['Brakujące dokumenty']).toBe('komplet');
  });

  it('attaches Benefivo B2B company context to custom_fields when employer_b2b lead exists', async () => {
    const b2bLead = {
      id: 'lead_b2b_1',
      referenceNumber: 'BNF-2026-999',
      name: 'Marta HR Lead',
      email: 'marta.hr@korpo.pl',
      phone: '+48523993855',
      leadType: 'employer_b2b',
      metadata: {
        companyName: 'Nowoczesna Firma Sp. z o.o.',
        companyNip: '5250001122',
        teamSize: '50-100',
        benefitModel: 'co_financing',
      },
    };

    const prisma = createPrisma({
      lead: { findFirst: vi.fn().mockResolvedValue(b2bLead) },
    });

    const result = await lookupCustomerByPhone(prisma, '523993855');

    expect(result).not.toBeNull();
    expect(result?.custom_fields['Marka']).toBe('Benefivo');
    expect(result?.custom_fields['Typ klienta']).toBe('Pracodawca B2B (program pracowniczy)');
    expect(result?.custom_fields['Firma']).toBe('Nowoczesna Firma Sp. z o.o.');
    expect(result?.custom_fields['NIP']).toBe('5250001122');
    expect(result?.custom_fields['Wielkosc zespolu']).toBe('50-100');
  });

  it('handles employer_b2b lead with null metadata without exception', async () => {
    const b2bLead = {
      id: 'lead_b2b_2',
      referenceNumber: 'BNF-2026-888',
      name: 'Tomasz Prezes',
      email: 'tomasz@firma.pl',
      phone: '+48523993855',
      leadType: 'employer_b2b',
      metadata: null,
    };

    const prisma = createPrisma({
      lead: { findFirst: vi.fn().mockResolvedValue(b2bLead) },
    });

    const result = await lookupCustomerByPhone(prisma, '523993855');

    expect(result).not.toBeNull();
    expect(result?.custom_fields['Marka']).toBe('Benefivo');
    expect(result?.custom_fields['Typ klienta']).toBe('Pracodawca B2B (program pracowniczy)');
    expect(result?.custom_fields['Firma']).toBeUndefined();
    expect(result?.custom_fields['NIP']).toBeUndefined();
    expect(result?.custom_fields['Wielkosc zespolu']).toBeUndefined();
  });

  it('omits empty metadata keys and preserves retail customer lookup identity', async () => {
    const b2bLead = {
      id: 'lead_b2b_3',
      name: 'Ewa Dyrektor',
      phone: '+48523993855',
      leadType: 'employer_b2b',
      metadata: {
        companyName: 'SoftHouse',
        companyNip: '  ',
        teamSize: null,
      },
    };

    const prisma = createPrisma({
      lead: { findFirst: vi.fn().mockResolvedValue(b2bLead) },
    });

    const result = await lookupCustomerByPhone(prisma, '523993855');

    expect(result?.custom_fields['Firma']).toBe('SoftHouse');
    expect(result?.custom_fields['NIP']).toBeUndefined();
    expect(result?.custom_fields['Wielkosc zespolu']).toBeUndefined();
  });
});
