import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient, ScopeType, LeadSourceChannel, PipelineActorType, ClientType, FinancingType, PipelineDocumentStatus } from '@prisma/client';
import { executeCreateOpportunity, executePatchOpportunity } from '../services/opportunity.service.js';
import { executeUpdateDocumentStatus } from '../services/document.service.js';

const prisma = new PrismaClient();

function getTestScope() {
  return {
    scopeType: ScopeType.DEALER_GROUP,
    scopeId: `test-docs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  };
}

const TEST_ACTOR = { type: PipelineActorType.USER, userId: 'user-m2-docs-1', label: 'Doradca Dokumenty' };

describe('Milestone M2: Documents Checklist & Materialization', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('automatically materializes required documents upon opportunity creation and updates', async () => {
    const scope = getTestScope();

    // 1. Create B2B Leasing opportunity
    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Pol-Trans Sp. z o.o.',
      customerPhone: '+48600999000',
      clientType: ClientType.B2B,
      companyName: 'Pol-Trans',
      companyNip: '1234567890',
      financingType: FinancingType.LEASING,
      actor: TEST_ACTOR,
    });

    // Verify initial materialized documents
    const initialDocs = await prisma.pipelineDocument.findMany({
      where: { opportunityId: opp.id },
    });

    expect(initialDocs.length).toBeGreaterThan(0);
    const codes = initialDocs.map((d) => d.code);
    expect(codes).toContain('COMPANY_REGISTRY');
    expect(codes).toContain('FINANCIAL_STATEMENTS');
  });

  it('transitions document status through lifecycle and computes hoursSinceRequest on RECEIVED', async () => {
    const scope = getTestScope();

    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Marek Dokumentowy',
      customerPhone: '+48600111333',
      clientType: ClientType.B2C,
      financingType: FinancingType.CREDIT,
      actor: TEST_ACTOR,
    });

    const doc = await prisma.pipelineDocument.findFirstOrThrow({
      where: { opportunityId: opp.id, code: 'ID_CONFIRMED' },
    });

    expect(doc.status).toBe(PipelineDocumentStatus.REQUIRED);

    // 1. Request document
    const requested = await executeUpdateDocumentStatus(
      prisma,
      scope,
      doc.id,
      {
        status: PipelineDocumentStatus.REQUESTED,
        requestedVia: 'EMAIL',
      },
      TEST_ACTOR
    );

    expect(requested.status).toBe(PipelineDocumentStatus.REQUESTED);
    expect(requested.requestedAt).toBeDefined();

    // 2. Receive document
    const received = await executeUpdateDocumentStatus(
      prisma,
      scope,
      doc.id,
      {
        status: PipelineDocumentStatus.RECEIVED,
      },
      TEST_ACTOR
    );

    expect(received.status).toBe(PipelineDocumentStatus.RECEIVED);
    expect(received.receivedAt).toBeDefined();

    // Verify DOCUMENT_RECEIVED event carries hoursSinceRequest
    const recEvent = await prisma.pipelineEvent.findFirst({
      where: {
        opportunityId: opp.id,
        type: 'DOCUMENT_RECEIVED',
      },
    });

    expect(recEvent).toBeDefined();
    expect((recEvent?.payload as any).code).toBe('ID_CONFIRMED');
    expect((recEvent?.payload as any).hoursSinceRequest).toBeGreaterThanOrEqual(0);

    // 3. Verify document
    const verified = await executeUpdateDocumentStatus(
      prisma,
      scope,
      doc.id,
      {
        status: PipelineDocumentStatus.VERIFIED,
      },
      TEST_ACTOR
    );

    expect(verified.status).toBe(PipelineDocumentStatus.VERIFIED);
  });

  it('marks obsolete documents as WAIVED when product changes, without deleting existing rows', async () => {
    const scope = getTestScope();

    // 1. Start with B2B Leasing (creates COMPANY_REGISTRY, FINANCIAL_STATEMENTS)
    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Firma Przelaczona',
      customerPhone: '+48600777999',
      clientType: ClientType.B2B,
      companyName: 'Firma Przelaczona',
      financingType: FinancingType.LEASING,
      actor: TEST_ACTOR,
    });

    const b2bDocs = await prisma.pipelineDocument.findMany({
      where: { opportunityId: opp.id },
    });
    expect(b2bDocs.some((d) => d.code === 'FINANCIAL_STATEMENTS')).toBe(true);

    // 2. Switch clientType to B2C (where FINANCIAL_STATEMENTS is no longer required)
    await executePatchOpportunity(prisma, {
      id: opp.id,
      clientType: ClientType.B2C,
      actor: TEST_ACTOR,
    });

    const docsAfter = await prisma.pipelineDocument.findMany({
      where: { opportunityId: opp.id },
    });

    const finDoc = docsAfter.find((d) => d.code === 'FINANCIAL_STATEMENTS');
    expect(finDoc).toBeDefined();
    expect(finDoc?.status).toBe(PipelineDocumentStatus.WAIVED); // Marked WAIVED, not deleted!
  });
});
