import { Prisma } from '@prisma/client';

/**
 * Allocates a sequential opportunity number for the given year atomically.
 * Uses an INSERT ... ON CONFLICT DO UPDATE RETURNING statement on pipeline_number_sequences.
 *
 * Guaranteed atomic under concurrency in PostgreSQL, with yearly reset and zero race conditions.
 * Format: MTL-<YYYY>-<5-digit sequence>, e.g. MTL-2026-00001
 */
export async function allocateOpportunityNumber(
  tx: Prisma.TransactionClient,
  year: number = new Date().getFullYear()
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ last_value: number }>>`
    INSERT INTO "pipeline_number_sequences" ("year", "last_value")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "last_value" = "pipeline_number_sequences"."last_value" + 1
    RETURNING "last_value";
  `;

  const sequence = rows[0]?.last_value ?? 1;
  return `MTL-${year}-${String(sequence).padStart(5, '0')}`;
}
