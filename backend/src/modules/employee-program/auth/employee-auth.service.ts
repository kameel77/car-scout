import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { EmployeeProfileResponse, ValidateCodeResult } from './employee-auth.types.js';

// Schematy walidacji Zod
const registrationCodeSchema = z
  .string({ required_error: 'Kod rejestracyjny jest wymagany', invalid_type_error: 'Kod rejestracyjny musi być tekstem' })
  .trim()
  .min(1, 'Kod rejestracyjny jest wymagany')
  .max(100, 'Kod rejestracyjny może mieć maksymalnie 100 znaków');

const emailSchema = z
  .string({ required_error: 'Adres e-mail jest wymagany', invalid_type_error: 'Adres e-mail musi być tekstem' })
  .trim()
  .min(1, 'Adres e-mail jest wymagany')
  .max(254, 'Adres e-mail może mieć maksymalnie 254 znaki')
  .email('Niepoprawny format adresu e-mail')
  .transform((val) => val.toLowerCase());

const passwordSchema = z
  .string({ required_error: 'Hasło jest wymagane', invalid_type_error: 'Hasło musi być tekstem' })
  .min(8, 'Hasło musi zawierać co najmniej 8 znaków')
  .refine(
    (val) => Buffer.byteLength(val, 'utf8') <= 72,
    'Hasło nie może przekraczać 72 bajtów'
  );

const optionalNameSchema = z
  .string({ invalid_type_error: 'Wartość pola musi być tekstem' })
  .trim()
  .max(100, 'Wartość pola nie może przekraczać 100 znaków')
  .optional()
  .nullable()
  .transform((val) => (val && val.length > 0 ? val : null));

const optionalPhoneSchema = z
  .string({ invalid_type_error: 'Numer telefonu musi być tekstem' })
  .trim()
  .max(30, 'Numer telefonu nie może przekraczać 30 znaków')
  .optional()
  .nullable()
  .transform((val) => (val && val.length > 0 ? val : null));

const registerEmployeeInputSchema = z.object({
  code: registrationCodeSchema,
  email: emailSchema,
  password: passwordSchema,
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
  phone: optionalPhoneSchema
});

export function hashRegistrationCode(code: string): string {
  const parseResult = registrationCodeSchema.safeParse(code);
  if (!parseResult.success) {
    throw { statusCode: 400, message: parseResult.error.errors[0]?.message || 'Nieprawidłowy kod rejestracyjny' };
  }
  const normalized = parseResult.data.toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Pomocnicza funkcja wykonująca zapytanie do bazy z weryfikacją kodu, firmy i programu.
 * Może działać na PrismaClient lub Prisma.TransactionClient.
 */
async function findAndValidateRegistrationCode(
  txOrPrisma: PrismaClient | Prisma.TransactionClient,
  code: string
) {
  const codeHash = hashRegistrationCode(code);

  const regCode = await txOrPrisma.employeeRegistrationCode.findUnique({
    where: { codeHash },
    include: {
      company: { select: { id: true, name: true, slug: true, isActive: true } },
      program: { select: { id: true, name: true, slug: true, isActive: true } }
    }
  });

  if (!regCode || !regCode.isActive) {
    throw { statusCode: 404, message: 'Nieprawidłowy lub nieaktywny kod rejestracyjny' };
  }

  const now = new Date();
  if (regCode.expiresAt && regCode.expiresAt <= now) {
    throw { statusCode: 410, message: 'Kod rejestracyjny wygasł' };
  }

  if (!regCode.company || !regCode.company.isActive || !regCode.program || !regCode.program.isActive) {
    throw { statusCode: 403, message: 'Program lub firma powiązana z kodem jest obecnie nieaktywna' };
  }

  return regCode;
}

export async function validateRegistrationCode(
  prisma: PrismaClient,
  code: string
): Promise<ValidateCodeResult> {
  const regCode = await findAndValidateRegistrationCode(prisma, code);

  return {
    valid: true,
    companyId: regCode.companyId,
    companyName: regCode.company.name,
    programId: regCode.programId,
    programName: regCode.program.name
  };
}

export interface RegisterEmployeeInput {
  code: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export async function registerEmployeeWithCode(
  prisma: PrismaClient,
  input: RegisterEmployeeInput
): Promise<EmployeeProfileResponse> {
  const parsed = registerEmployeeInputSchema.safeParse(input);
  if (!parsed.success) {
    const firstErr = parsed.error.errors[0];
    throw { statusCode: 400, message: firstErr?.message || 'Niepoprawne dane wejściowe' };
  }

  const { code, email: normalizedEmail, password, firstName, lastName, phone } = parsed.data;

  // Wstępne sprawdzenie czy konto już istnieje (fast-path precheck)
  const existingAccount = await prisma.employeeAccount.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingAccount) {
    throw { statusCode: 409, message: 'Konto o podanym adresie e-mail już istnieje' };
  }

  // Weryfikacja kodu poza transakcją, aby odrzucić błędny input wcześnie
  await findAndValidateRegistrationCode(prisma, code);

  // Bezpieczne generowanie hasha hasła async POZA transakcją (nie blokuje połączenia/transakcji DB)
  const passwordHash = await bcrypt.hash(password, 10);

  // Wykonanie transakcji Serializable z ograniczonym retry przy konfliktach współbieżności (P2034)
  const MAX_RETRIES = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Rewalidacja kodu, statusu firmy i programu WEWNĄTRZ transakcji Serializable
          const validRegCode = await findAndValidateRegistrationCode(tx, code);

          // Rewalidacja unikalności e-maila
          const accountInTx = await tx.employeeAccount.findUnique({
            where: { email: normalizedEmail }
          });
          if (accountInTx) {
            throw { statusCode: 409, message: 'Konto o podanym adresie e-mail już istnieje' };
          }

          const account = await tx.employeeAccount.create({
            data: {
              email: normalizedEmail,
              passwordHash,
              firstName: firstName || null,
              lastName: lastName || null,
              phone: phone || null,
              isActive: true
            }
          });

          const membership = await tx.employeeMembership.create({
            data: {
              accountId: account.id,
              companyId: validRegCode.companyId,
              programId: validRegCode.programId,
              isActive: true
            }
          });

          await tx.employeeMembershipAudit.create({
            data: {
              accountId: account.id,
              companyId: validRegCode.companyId,
              programId: validRegCode.programId,
              action: 'CREATED',
              reason: 'Rejestracja kodem firmy'
            }
          });

          return {
            account,
            membership,
            company: validRegCode.company,
            program: validRegCode.program
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000
        }
      );

      return {
        id: result.account.id,
        email: result.account.email,
        firstName: result.account.firstName,
        lastName: result.account.lastName,
        phone: result.account.phone,
        company: {
          id: result.company.id,
          name: result.company.name,
          slug: result.company.slug
        },
        program: {
          id: result.program.id,
          name: result.program.name,
          slug: result.program.slug
        },
        createdAt: result.account.createdAt.toISOString()
      };
    } catch (err: any) {
      // Obsługa naruszenia unikalności (P2002)
      if (err?.code === 'P2002') {
        throw { statusCode: 409, message: 'Konto o podanym adresie e-mail już istnieje' };
      }

      // Obsługa błędu serializacji/konfliktu współbieżności (P2034) - ponowienie
      if (err?.code === 'P2034') {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          // Krótki backoff z jitterem
          await new Promise((resolve) => setTimeout(resolve, 10 * Math.pow(2, attempt) + Math.random() * 20));
          continue;
        }
        throw { statusCode: 409, message: 'Wystąpił konflikt współbieżności podczas rejestracji, spróbuj ponownie' };
      }

      // Inne kontrolowane lub niekontrolowane błędy
      throw err;
    }
  }

  throw lastError || { statusCode: 500, message: 'Błąd rejestracji' };
}

export interface LoginEmployeeResult {
  account: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
  membership: {
    companyId: string;
    companyName: string;
    companySlug: string;
    programId: string;
    programName: string;
    programSlug: string;
  };
}

const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Hasło jest wymagane', invalid_type_error: 'Hasło musi być tekstem' })
    .min(1, 'Hasło jest wymagane')
    .refine((val) => Buffer.byteLength(val, 'utf8') <= 72, 'Hasło nie może przekraczać 72 bajtów')
});

// Stały dummy hash do porównania w stałym czasie przy braku użytkownika / nieaktywnym koncie
const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';

export async function authenticateEmployee(
  prisma: PrismaClient,
  email: string,
  password: string
): Promise<LoginEmployeeResult> {
  const parsed = loginInputSchema.safeParse({ email, password });
  if (!parsed.success) {
    throw { statusCode: 400, message: parsed.error.errors[0]?.message || 'Adres e-mail i hasło są wymagane' };
  }

  const { email: normalizedEmail, password: cleanPassword } = parsed.data;

  const account = await prisma.employeeAccount.findUnique({
    where: { email: normalizedEmail },
    include: {
      membership: {
        include: {
          company: true,
          program: true
        }
      }
    }
  });

  // Timing-safe verification i zapobieganie enumeracji użytkowników:
  // Zawsze wykonujemy compare async, nawet gdy konto nie istnieje lub jest nieaktywne
  const hashToCompare = account?.passwordHash || DUMMY_HASH;
  const isPasswordValid = await bcrypt.compare(cleanPassword, hashToCompare);

  if (!account || !isPasswordValid || !account.isActive) {
    // Generyczny błąd 401 uniemożliwiający enumerację e-maili i stanu konta
    throw { statusCode: 401, message: 'Nieprawidłowy login lub hasło' };
  }

  const membership = account.membership;
  if (!membership || !membership.isActive || membership.revokedAt) {
    throw { statusCode: 403, message: 'Brak aktywnego członkostwa w programie pracowniczym' };
  }

  if (!membership.company || !membership.company.isActive || !membership.program || !membership.program.isActive) {
    throw { statusCode: 403, message: 'Program lub firma pracodawcy są obecnie nieaktywne' };
  }

  // Uaktualnienie lastLoginAt
  await prisma.employeeAccount.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() }
  });

  return {
    account: {
      id: account.id,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      phone: account.phone
    },
    membership: {
      companyId: membership.company.id,
      companyName: membership.company.name,
      companySlug: membership.company.slug,
      programId: membership.program.id,
      programName: membership.program.name,
      programSlug: membership.program.slug
    }
  };
}

const accountIdSchema = z
  .string({ required_error: 'Identyfikator konta jest wymagany', invalid_type_error: 'Nieprawidłowy format identyfikatora' })
  .trim()
  .min(1, 'Identyfikator konta jest wymagany')
  .max(128, 'Identyfikator konta jest zbyt długi');

export async function getEmployeeProfile(
  prisma: PrismaClient,
  accountId: string
): Promise<EmployeeProfileResponse> {
  const parsed = accountIdSchema.safeParse(accountId);
  if (!parsed.success) {
    throw { statusCode: 400, message: parsed.error.errors[0]?.message || 'Nieprawidłowy identyfikator' };
  }

  const account = await prisma.employeeAccount.findUnique({
    where: { id: parsed.data },
    include: {
      membership: {
        include: {
          company: true,
          program: true
        }
      }
    }
  });

  if (!account) {
    throw { statusCode: 404, message: 'Konto pracownicze nie zostało odnalezione' };
  }

  if (!account.isActive) {
    throw { statusCode: 403, message: 'Konto pracownicze jest nieaktywne' };
  }

  if (!account.membership || !account.membership.isActive || account.membership.revokedAt) {
    throw { statusCode: 403, message: 'Brak aktywnego członkostwa w programie' };
  }

  if (!account.membership.company || !account.membership.company.isActive) {
    throw { statusCode: 403, message: 'Firma pracodawcy powiązana z kontem jest nieaktywna' };
  }

  if (!account.membership.program || !account.membership.program.isActive) {
    throw { statusCode: 403, message: 'Program pracowniczy powiązany z kontem jest nieaktywny' };
  }

  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    phone: account.phone,
    company: {
      id: account.membership.company.id,
      name: account.membership.company.name,
      slug: account.membership.company.slug
    },
    program: {
      id: account.membership.program.id,
      name: account.membership.program.name,
      slug: account.membership.program.slug
    },
    createdAt: account.createdAt.toISOString()
  };
}
