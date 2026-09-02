import { Prisma, PrismaClient, ScopeType, PipelineDocumentStatus } from '@prisma/client';
import { recordEvent } from '../events/record-event.js';
import { ActorContext } from './opportunity.service.js';

export type UpdateDocumentStatusInput = {
  status: PipelineDocumentStatus;
  note?: string | null;
  requestedVia?: string | null;
  reason?: string | null;
};

/**
 * Automatically materializes required documents for an opportunity based on its
 * clientType, financingType, and the latest application's financierId.
 *
 * Idempotent:
 * - Existing documents keep their status.
 * - Newly matching requirements are created as REQUIRED.
 * - Requirements that no longer apply are marked as WAIVED (never deleted).
 */
export async function materializeDocumentsForOpportunity(
  tx: Prisma.TransactionClient,
  opportunityId: string
) {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      documents: true,
      applications: {
        where: { state: { not: 'WITHDRAWN' } },
        orderBy: { roundNumber: 'desc' },
      },
    },
  });

  const activeFinancierIds = Array.from(
    new Set(opportunity.applications.map((a) => a.financierId).filter(Boolean))
  );

  // Find matching document requirements (union of general + all active financiers)
  const requirements = await tx.pipelineDocumentRequirement.findMany({
    where: {
      OR: [
        { scopeType: opportunity.scopeType, scopeId: opportunity.scopeId },
        { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' },
      ],
      AND: [
        {
          OR: [
            { clientType: null },
            { clientType: opportunity.clientType },
          ],
        },
        {
          OR: [
            { financingType: null },
            { financingType: opportunity.financingType },
          ],
        },
        {
          OR: [
            { financierId: null },
            ...(activeFinancierIds.length > 0 ? [{ financierId: { in: activeFinancierIds } }] : []),
          ],
        },
      ],
    },
    orderBy: { sortOrder: 'asc' },
  });

  const activeReqCodes = new Set(requirements.map((r) => r.code));
  const existingDocsMap = new Map(opportunity.documents.map((d) => [d.code, d]));

  // 1. Create or restore required documents
  for (const req of requirements) {
    const existing = existingDocsMap.get(req.code);
    if (!existing) {
      await tx.pipelineDocument.create({
        data: {
          opportunityId,
          requirementId: req.id,
          code: req.code,
          label: req.label,
          status: PipelineDocumentStatus.REQUIRED,
        },
      });
    } else if (existing.status === PipelineDocumentStatus.WAIVED) {
      await tx.pipelineDocument.update({
        where: { id: existing.id },
        data: {
          status: PipelineDocumentStatus.REQUIRED,
          requirementId: req.id,
          label: req.label,
        },
      });
    }
  }

  // 2. Mark obsolete required/requested documents as WAIVED (preserving already received/verified)
  for (const doc of opportunity.documents) {
    if (!activeReqCodes.has(doc.code)) {
      if (
        doc.status === PipelineDocumentStatus.REQUIRED ||
        doc.status === PipelineDocumentStatus.REQUESTED
      ) {
        await tx.pipelineDocument.update({
          where: { id: doc.id },
          data: {
            status: PipelineDocumentStatus.WAIVED,
            note: doc.note ? `${doc.note} (Nieaktualny po zmianie produktu)` : 'Nieaktualny po zmianie produktu',
          },
        });
      }
    }
  }

  return tx.pipelineDocument.findMany({
    where: { opportunityId },
    orderBy: { code: 'asc' },
  });
}

export async function updateDocumentStatus(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  documentId: string,
  input: UpdateDocumentStatusInput,
  actor: ActorContext
) {
  const document = await tx.pipelineDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: {
      opportunity: true,
    },
  });

  const now = new Date();
  const updateData: Prisma.PipelineDocumentUpdateInput = {
    status: input.status,
    note: input.note !== undefined ? input.note : document.note,
  };

  let eventType = 'DOCUMENT_REQUESTED';
  let eventPayload: Record<string, unknown> = {};

  switch (input.status) {
    case PipelineDocumentStatus.REQUESTED:
      updateData.requestedAt = now;
      eventType = 'DOCUMENT_REQUESTED';
      eventPayload = {
        code: document.code,
        label: document.label,
        requestedVia: input.requestedVia || 'EMAIL',
      };
      break;

    case PipelineDocumentStatus.RECEIVED: {
      updateData.receivedAt = now;
      const hoursSinceRequest = document.requestedAt
        ? Math.max(0, Math.round((now.getTime() - document.requestedAt.getTime()) / (1000 * 60 * 60)))
        : 0;
      eventType = 'DOCUMENT_RECEIVED';
      eventPayload = {
        code: document.code,
        hoursSinceRequest,
      };
      break;
    }

    case PipelineDocumentStatus.VERIFIED:
      updateData.verifiedAt = now;
      eventType = 'DOCUMENT_VERIFIED';
      eventPayload = {
        code: document.code,
      };
      break;

    case PipelineDocumentStatus.WAIVED:
      eventType = 'DOCUMENT_WAIVED';
      eventPayload = {
        code: document.code,
        reason: input.reason || input.note || 'Odstąpiono od wymogu',
      };
      break;

    case PipelineDocumentStatus.REQUIRED:
    default:
      // Reset timestamps if reverting to required
      updateData.receivedAt = null;
      updateData.verifiedAt = null;
      break;
  }

  const updated = await tx.pipelineDocument.update({
    where: { id: documentId },
    data: updateData,
  });

  if (eventType) {
    await recordEvent(tx, {
      scopeType: document.opportunity.scopeType,
      scopeId: document.opportunity.scopeId,
      type: eventType as any,
      aggregateType: 'DOCUMENT',
      aggregateId: updated.id,
      opportunityId: document.opportunityId,
      customerId: document.opportunity.customerId,
      actor,
      payload: eventPayload,
    });
  }

  return updated;
}

// Transactional helper wrappers
export async function executeMaterializeDocuments(
  prisma: PrismaClient,
  opportunityId: string
) {
  return prisma.$transaction((tx) =>
    materializeDocumentsForOpportunity(tx, opportunityId)
  );
}

export async function executeUpdateDocumentStatus(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string },
  documentId: string,
  input: UpdateDocumentStatusInput,
  actor: ActorContext
) {
  return prisma.$transaction((tx) =>
    updateDocumentStatus(tx, scope, documentId, input, actor)
  );
}
