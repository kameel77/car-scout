import {
  PrismaClient,
  ScopeType,
  ClientType,
  FinancingType,
  PipelinePhase,
} from '@prisma/client';

const PLATFORM_SCOPE = { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' } as const;

export async function seedPipeline(prisma: PrismaClient) {
  console.log('🌱 Seeding Pipeline module...');

  // 1. Loss reasons
  const lossReasons = [
    { code: 'FIN_CREDITWORTHINESS', label: 'Zdolność kredytowa / dochody', category: 'FINANCIER', requiresComment: false, sortOrder: 10 },
    { code: 'FIN_BIK_DEBT', label: 'BIK / komornik / zadłużenie', category: 'FINANCIER', requiresComment: false, sortOrder: 20 },
    { code: 'FIN_VEHICLE_NOT_ACCEPTED', label: 'Pojazd nieakceptowany przez finansującego', category: 'FINANCIER', requiresComment: false, sortOrder: 30 },
    { code: 'FIN_OTHER', label: 'Inny powód po stronie finansującego', category: 'FINANCIER', requiresComment: true, sortOrder: 40 },
    { code: 'CUST_NO_DOCUMENTS', label: 'Brak dokumentów od klienta', category: 'CUSTOMER', requiresComment: false, sortOrder: 50 },
    { code: 'CUST_RESIGNED', label: 'Rezygnacja klienta', category: 'CUSTOMER', requiresComment: false, sortOrder: 60 },
    { code: 'CUST_TERMS_REJECTED', label: 'Warunki nie do zaakceptowania', category: 'CUSTOMER', requiresComment: false, sortOrder: 70 },
    { code: 'CUST_BOUGHT_ELSEWHERE', label: 'Kupił w innym miejscu', category: 'CUSTOMER', requiresComment: false, sortOrder: 80 },
    { code: 'CUST_NO_CONTACT', label: 'Brak kontaktu', category: 'CUSTOMER', requiresComment: false, sortOrder: 90 },
    { code: 'QUAL_NOT_ELIGIBLE', label: 'Niekwalifikowany', category: 'QUALIFICATION', requiresComment: false, sortOrder: 100 },
    { code: 'QUAL_SPAM', label: 'Spam / pomyłka', category: 'QUALIFICATION', requiresComment: false, sortOrder: 110 },
    { code: 'OTHER', label: 'Inne', category: 'QUALIFICATION', requiresComment: true, sortOrder: 120 },
    { code: 'CONTRACTED_ELSEWHERE', label: 'Wybrano innego finansującego', category: 'APPLICATION_WITHDRAWN', requiresComment: false, sortOrder: 200 },
  ];

  for (const lr of lossReasons) {
    await prisma.pipelineLossReason.upsert({
      where: { code: lr.code },
      update: {
        label: lr.label,
        category: lr.category,
        requiresComment: lr.requiresComment,
        sortOrder: lr.sortOrder,
        isActive: true,
      },
      create: {
        code: lr.code,
        label: lr.label,
        category: lr.category,
        requiresComment: lr.requiresComment,
        sortOrder: lr.sortOrder,
        isActive: true,
      },
    });
  }
  console.log(`  ✅ Seeded ${lossReasons.length} loss reasons`);

  // 2. Financiers (code, name, isActive only; criteria left empty per spec)
  const financiers = [
    { code: 'AYVENS', name: 'Ayvens' },
    { code: 'VEHIS', name: 'Vehis' },
    { code: 'VELO', name: 'Velo' },
    { code: 'ATHLON', name: 'Athlon' },
    { code: 'LEASYS', name: 'Leasys' },
    { code: 'INBANK', name: 'Inbank' },
    { code: 'SANTANDER', name: 'Santander' },
  ];

  for (const f of financiers) {
    await prisma.pipelineFinancier.upsert({
      where: {
        scopeType_scopeId_code: {
          scopeType: PLATFORM_SCOPE.scopeType,
          scopeId: PLATFORM_SCOPE.scopeId,
          code: f.code,
        },
      },
      update: {
        name: f.name,
        isActive: true,
      },
      create: {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        code: f.code,
        name: f.name,
        isActive: true,
      },
    });
  }
  console.log(`  ✅ Seeded ${financiers.length} financiers`);

  // 3. Phase requirements
  const phaseRequirements: Array<{
    code: string;
    targetPhase: PipelinePhase;
    fieldPath: string;
    label: string;
    clientType?: ClientType | null;
    financingType?: FinancingType | null;
    enforcement: 'HARD' | 'SOFT';
    sortOrder: number;
  }> = [
    // HARD: FINANCIAL_DECISION
    { code: 'REQ_FIN_FINANCING_TYPE', targetPhase: PipelinePhase.FINANCIAL_DECISION, fieldPath: 'opportunity.financingType', label: 'Rodzaj finansowania', enforcement: 'HARD', sortOrder: 10 },
    { code: 'REQ_FIN_PRICE', targetPhase: PipelinePhase.FINANCIAL_DECISION, fieldPath: 'offer.priceGrosze', label: 'Cena pojazdu', enforcement: 'HARD', sortOrder: 20 },
    { code: 'REQ_FIN_RATE', targetPhase: PipelinePhase.FINANCIAL_DECISION, fieldPath: 'offer.monthlyRateGrosze', label: 'Rata miesięczna', enforcement: 'HARD', sortOrder: 30 },
    { code: 'REQ_FIN_FINANCIER', targetPhase: PipelinePhase.FINANCIAL_DECISION, fieldPath: 'application.financierId', label: 'Wybrany finansujący', enforcement: 'HARD', sortOrder: 40 },
    { code: 'REQ_FIN_NIP', targetPhase: PipelinePhase.FINANCIAL_DECISION, fieldPath: 'customer.companyNip', label: 'NIP firmy', clientType: ClientType.B2B, enforcement: 'HARD', sortOrder: 50 },

    // HARD: DELIVERY
    { code: 'REQ_DEL_CONTRACT_SIGNED', targetPhase: PipelinePhase.DELIVERY, fieldPath: 'opportunity.contractSignedAt', label: 'Data podpisania umowy', enforcement: 'HARD', sortOrder: 60 },
    { code: 'REQ_DEL_COMMISSION_BASIS', targetPhase: PipelinePhase.DELIVERY, fieldPath: 'commission.basisGrosze', label: 'Podstawa naliczenia prowizji', enforcement: 'SOFT', sortOrder: 70 },

    // SOFT: QUALIFICATION, SELECTION, COMPLETING
    { code: 'REQ_QUAL_CLIENT_TYPE', targetPhase: PipelinePhase.QUALIFICATION, fieldPath: 'opportunity.clientType', label: 'Typ klienta', enforcement: 'SOFT', sortOrder: 10 },
    { code: 'REQ_QUAL_LEAD_SOURCE', targetPhase: PipelinePhase.QUALIFICATION, fieldPath: 'opportunity.leadSource', label: 'Źródło leada', enforcement: 'SOFT', sortOrder: 20 },
    { code: 'REQ_SEL_VEHICLE', targetPhase: PipelinePhase.SELECTION, fieldPath: 'selectedCandidateId', label: 'Wybrany pojazd', enforcement: 'SOFT', sortOrder: 10 },
    { code: 'REQ_COMP_DOCUMENTS', targetPhase: PipelinePhase.COMPLETING, fieldPath: 'documents.mandatoryReceived', label: 'Wymagane dokumenty', enforcement: 'SOFT', sortOrder: 10 },
  ];

  for (const pr of phaseRequirements) {
    await prisma.pipelinePhaseRequirement.upsert({
      where: {
        scopeType_scopeId_code: {
          scopeType: PLATFORM_SCOPE.scopeType,
          scopeId: PLATFORM_SCOPE.scopeId,
          code: pr.code,
        },
      },
      update: {
        targetPhase: pr.targetPhase,
        fieldPath: pr.fieldPath,
        label: pr.label,
        clientType: pr.clientType ?? null,
        financingType: pr.financingType ?? null,
        enforcement: pr.enforcement,
        sortOrder: pr.sortOrder,
        isActive: true,
      },
      create: {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        code: pr.code,
        targetPhase: pr.targetPhase,
        fieldPath: pr.fieldPath,
        label: pr.label,
        clientType: pr.clientType ?? null,
        financingType: pr.financingType ?? null,
        enforcement: pr.enforcement,
        sortOrder: pr.sortOrder,
        isActive: true,
      },
    });
  }
  console.log(`  ✅ Seeded ${phaseRequirements.length} phase requirements`);

  // 4. Document requirements
  const documentRequirements: Array<{
    code: string;
    label: string;
    clientType?: ClientType | null;
    financingType?: FinancingType | null;
    isMandatory: boolean;
    sortOrder: number;
  }> = [
    // B2C
    { code: 'ID_CONFIRMED', label: 'Potwierdzenie tożsamości', clientType: ClientType.B2C, isMandatory: true, sortOrder: 10 },
    { code: 'INCOME_PROOF', label: 'Potwierdzenie dochodu', clientType: ClientType.B2C, isMandatory: true, sortOrder: 20 },

    // B2B
    { code: 'COMPANY_REGISTRY', label: 'Wpis CEIDG / KRS', clientType: ClientType.B2B, isMandatory: true, sortOrder: 30 },
    { code: 'FINANCIAL_STATEMENTS', label: 'Dokumenty finansowe firmy', clientType: ClientType.B2B, isMandatory: true, sortOrder: 40 },

    // CASH
    { code: 'PROFORMA', label: 'Proforma / faktura zaliczkowa', financingType: FinancingType.CASH, isMandatory: true, sortOrder: 50 },
  ];

  for (const dr of documentRequirements) {
    const existing = await prisma.pipelineDocumentRequirement.findFirst({
      where: {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        code: dr.code,
        clientType: dr.clientType ?? null,
        financingType: dr.financingType ?? null,
        financierId: null,
      },
    });

    if (existing) {
      await prisma.pipelineDocumentRequirement.update({
        where: { id: existing.id },
        data: {
          label: dr.label,
          isMandatory: dr.isMandatory,
          sortOrder: dr.sortOrder,
        },
      });
    } else {
      await prisma.pipelineDocumentRequirement.create({
        data: {
          scopeType: PLATFORM_SCOPE.scopeType,
          scopeId: PLATFORM_SCOPE.scopeId,
          code: dr.code,
          label: dr.label,
          clientType: dr.clientType ?? null,
          financingType: dr.financingType ?? null,
          isMandatory: dr.isMandatory,
          sortOrder: dr.sortOrder,
        },
      });
    }
  }
  console.log(`  ✅ Seeded ${documentRequirements.length} document requirements`);
}
