import { Prisma, ScopeType, ClientType, PipelineCustomer } from '@prisma/client';

const UNMATCHABLE_PHONES = new Set([
  '000000000',
  '111111111',
  '123456789',
  '999999999',
  '+48000000000',
  '+48111111111',
  '+48123456789',
  '+48999999999',
]);

/**
 * Normalizes phone numbers to standard E.164-like format.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '').trim();
  if (!cleaned) return null;

  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  // International 00 prefix (e.g. 0048123456789 -> +48123456789)
  if (cleaned.startsWith('00') && cleaned.length > 9) {
    return `+${cleaned.slice(2)}`;
  }
  // Polish 9-digit local number
  if (/^\d{9}$/.test(cleaned)) {
    return `+48${cleaned}`;
  }
  return cleaned;
}

export function isUnmatchablePhone(phone: string | null | undefined): boolean {
  if (!phone) return true;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return true;
  // If all digits are the same, e.g. 000000000, 111111111, 999999999
  if (/^(\d)\1+$/.test(digits)) return true;
  // Common dummy sequences
  if (digits === '123456789' || digits === '987654321') return true;

  const norm = normalizePhone(phone);
  if (!norm) return true;
  if (UNMATCHABLE_PHONES.has(norm) || UNMATCHABLE_PHONES.has(digits)) {
    return true;
  }
  return false;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeNip(nip: string | null | undefined): string | null {
  if (!nip) return null;
  const digits = nip.replace(/[\s\-]/g, '').replace(/^PL/i, '').trim();
  return digits.length > 0 ? digits : null;
}

export type FindMatchResult = {
  match: PipelineCustomer | null;
  isAmbiguous: boolean;
};

/**
 * Matches an existing customer by normalized phone, then email, then NIP.
 *
 * Rules:
 * - If multiple matching rows are found for any key, match is considered AMBIGUOUS.
 *   We NEVER pick the first row and NEVER auto-merge.
 * - Placeholder / switchboard / anonymous numbers are treated as unmatchable.
 */
export async function findCustomerMatch(
  tx: Prisma.TransactionClient,
  input: {
    scopeType: ScopeType;
    scopeId: string;
    phone?: string | null;
    email?: string | null;
    nip?: string | null;
  }
): Promise<FindMatchResult> {
  const normPhone = normalizePhone(input.phone);
  const normEmail = normalizeEmail(input.email);
  const normNip = normalizeNip(input.nip);

  // 1. Match by Phone
  if (normPhone && !isUnmatchablePhone(normPhone)) {
    const phoneMatches = await tx.pipelineCustomer.findMany({
      where: {
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        phone: normPhone,
      },
      take: 2,
    });

    if (phoneMatches.length === 1) {
      return { match: phoneMatches[0], isAmbiguous: false };
    }
    if (phoneMatches.length > 1) {
      return { match: null, isAmbiguous: true };
    }
  }

  // 2. Match by Email
  if (normEmail) {
    const emailMatches = await tx.pipelineCustomer.findMany({
      where: {
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        email: normEmail,
      },
      take: 2,
    });

    if (emailMatches.length === 1) {
      return { match: emailMatches[0], isAmbiguous: false };
    }
    if (emailMatches.length > 1) {
      return { match: null, isAmbiguous: true };
    }
  }

  // 3. Match by NIP
  if (normNip) {
    const nipMatches = await tx.pipelineCustomer.findMany({
      where: {
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        companyNip: normNip,
      },
      take: 2,
    });

    if (nipMatches.length === 1) {
      return { match: nipMatches[0], isAmbiguous: false };
    }
    if (nipMatches.length > 1) {
      return { match: null, isAmbiguous: true };
    }
  }

  return { match: null, isAmbiguous: false };
}

export async function findOrCreateCustomer(
  tx: Prisma.TransactionClient,
  input: {
    scopeType: ScopeType;
    scopeId: string;
    fullName: string;
    phone?: string | null;
    email?: string | null;
    companyName?: string | null;
    companyNip?: string | null;
    clientType?: ClientType;
  }
): Promise<{ customer: PipelineCustomer; isNew: boolean; isAmbiguous: boolean }> {
  const normPhone = normalizePhone(input.phone);
  const normEmail = normalizeEmail(input.email);
  const normNip = normalizeNip(input.companyNip);

  const { match, isAmbiguous } = await findCustomerMatch(tx, {
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    phone: normPhone,
    email: normEmail,
    nip: normNip,
  });

  if (match) {
    return { customer: match, isNew: false, isAmbiguous: false };
  }

  const newCustomer = await tx.pipelineCustomer.create({
    data: {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      fullName: input.fullName.trim() || 'Klient',
      phone: normPhone,
      email: normEmail,
      companyName: input.companyName?.trim() || null,
      companyNip: normNip,
      clientType: input.clientType ?? ClientType.UNKNOWN,
    },
  });

  return { customer: newCustomer, isNew: true, isAmbiguous };
}
