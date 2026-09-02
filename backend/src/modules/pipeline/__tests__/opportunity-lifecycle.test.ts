import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  PrismaClient,
  PipelineActorType,
  LeadSourceChannel,
  PipelinePhase,
  OpportunityStatus,
  User,
} from '@prisma/client';
import {
  createOpportunity,
  changePhase,
  assignOwner,
  setNextAction,
  logContact,
  closeWon,
  closeLost,
} from '../services/opportunity.service.js';
import { PLATFORM_SCOPE } from '../events/record-event.js';
import { findOrCreateCustomer } from '../services/customer.service.js';

describe('Opportunity Lifecycle & Service Logic', () => {
  const prisma = new PrismaClient();
  let testUser: User | null = null;

  beforeAll(async () => {
    await prisma.$connect();
    testUser = await prisma.user.findFirst();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects creation without leadSource at schema / service level', async () => {
    await expect(
      prisma.$transaction((tx) =>
        createOpportunity(tx, {
          scopeType: PLATFORM_SCOPE.scopeType,
          scopeId: PLATFORM_SCOPE.scopeId,
          leadSource: undefined as any,
          customerName: 'Test No Source',
          actor: { type: PipelineActorType.USER },
        })
      )
    ).rejects.toThrow(/leadSource is required/i);
  });

  it('creates opportunity with formatted number, customer match, and event logging', async () => {
    const opp = await prisma.$transaction((tx) =>
      createOpportunity(tx, {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        leadSource: LeadSourceChannel.ORGANIC,
        leadSourceDetail: 'Wyszukiwarka Google',
        customerName: 'Tomasz Kowalczyk',
        customerPhone: '500 100 200',
        customerEmail: 'tomasz.kowalczyk@example.com',
        ownerUserId: testUser?.id ?? null,
        nextActionType: 'CALL_FIRST',
        nextActionDueAt: new Date(Date.now() + 3600 * 1000),
        nextActionNote: 'Pilny kontakt przed południem',
        actor: { type: PipelineActorType.USER, userId: testUser?.id, label: 'Doradca 1' },
      })
    );

    expect(opp.id).toBeTruthy();
    expect(opp.number).toMatch(/^MTL-\d{4}-\d{5}$/);
    expect(opp.phase).toBe(PipelinePhase.QUALIFICATION);
    expect(opp.status).toBe(OpportunityStatus.OPEN);

    // Verify events were recorded
    const events = await prisma.pipelineEvent.findMany({
      where: { opportunityId: opp.id },
      orderBy: { occurredAt: 'asc' },
    });

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('OPPORTUNITY_CREATED');
    if (testUser?.id) {
      expect(eventTypes).toContain('OPPORTUNITY_OWNER_CHANGED');
    }
    expect(eventTypes).toContain('OPPORTUNITY_NEXT_ACTION_SET');
  });

  it('changePhase resets phaseEnteredAt and computes durationSeconds correctly across transitions', async () => {
    // 1. Create opportunity with controlled past time for creation
    const opp = await prisma.$transaction((tx) =>
      createOpportunity(tx, {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        leadSource: LeadSourceChannel.META,
        customerName: 'Marek Zegarowy',
        actor: { type: PipelineActorType.USER },
      })
    );

    // Manually set phaseEnteredAt to 10 seconds ago
    const tenSecondsAgo = new Date(Date.now() - 10000);
    await prisma.pipelineOpportunity.update({
      where: { id: opp.id },
      data: { phaseEnteredAt: tenSecondsAgo },
    });

    // 2. Transition 1: QUALIFICATION -> SELECTION
    const transition1 = await prisma.$transaction((tx) =>
      changePhase(tx, {
        id: opp.id,
        targetPhase: PipelinePhase.SELECTION,
        actor: { type: PipelineActorType.USER },
      })
    );

    expect(transition1.phase).toBe(PipelinePhase.SELECTION);
    expect(transition1.phaseEnteredAt.getTime()).toBeGreaterThan(tenSecondsAgo.getTime());

    const event1 = await prisma.pipelineEvent.findFirstOrThrow({
      where: {
        opportunityId: opp.id,
        type: 'OPPORTUNITY_PHASE_CHANGED',
        payload: { path: ['after'], equals: 'SELECTION' },
      },
    });
    const payload1 = event1.payload as { durationSeconds: number; before: string; after: string };
    expect(payload1.before).toBe('QUALIFICATION');
    expect(payload1.after).toBe('SELECTION');
    expect(payload1.durationSeconds).toBeGreaterThanOrEqual(9);

    // Manually set phaseEnteredAt for phase 2 to 5 seconds ago
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    await prisma.pipelineOpportunity.update({
      where: { id: opp.id },
      data: { phaseEnteredAt: fiveSecondsAgo },
    });

    // 3. Transition 2: SELECTION -> COMPLETING
    const transition2 = await prisma.$transaction((tx) =>
      changePhase(tx, {
        id: opp.id,
        targetPhase: PipelinePhase.COMPLETING,
        actor: { type: PipelineActorType.USER },
      })
    );

    expect(transition2.phase).toBe(PipelinePhase.COMPLETING);

    const event2 = await prisma.pipelineEvent.findFirstOrThrow({
      where: {
        opportunityId: opp.id,
        type: 'OPPORTUNITY_PHASE_CHANGED',
        payload: { path: ['after'], equals: 'COMPLETING' },
      },
    });
    const payload2 = event2.payload as { durationSeconds: number; before: string; after: string };
    expect(payload2.before).toBe('SELECTION');
    expect(payload2.after).toBe('COMPLETING');
    // Crucial assertion: durationSeconds on event2 measures ONLY phase 2 (~5s), NOT total time (~15s)!
    expect(payload2.durationSeconds).toBeGreaterThanOrEqual(4);
    expect(payload2.durationSeconds).toBeLessThan(9);
  });

  it('logContact sets firstContactAt on first touch and records OPPORTUNITY_FIRST_CONTACT', async () => {
    const opp = await prisma.$transaction((tx) =>
      createOpportunity(tx, {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        leadSource: LeadSourceChannel.GOOGLE,
        customerName: 'Ewa Pierwszokontaktowa',
        actor: { type: PipelineActorType.USER },
      })
    );

    expect(opp.firstContactAt).toBeNull();

    const logged = await prisma.$transaction((tx) =>
      logContact(tx, {
        id: opp.id,
        channel: 'CALL',
        note: 'Klientka zainteresowana leasingiem Toyoty Yaris',
        nextActionType: 'OFFER_PREPARE',
        nextActionDueAt: new Date(Date.now() + 86400 * 1000),
        actor: { type: PipelineActorType.USER, label: 'Doradca Ewy' },
      })
    );

    expect(logged.firstContactAt).not.toBeNull();
    expect(logged.nextActionType).toBe('OFFER_PREPARE');

    const firstContactEvent = await prisma.pipelineEvent.findFirst({
      where: {
        opportunityId: opp.id,
        type: 'OPPORTUNITY_FIRST_CONTACT',
      },
    });
    expect(firstContactEvent).toBeDefined();
    expect((firstContactEvent?.payload as any)?.channel).toBe('CALL');

    const noteEvent = await prisma.pipelineEvent.findFirst({
      where: {
        opportunityId: opp.id,
        type: 'NOTE_ADDED',
      },
    });
    expect(noteEvent).toBeDefined();
    expect((noteEvent?.payload as any)?.content).toContain('Toyoty Yaris');
  });

  it('closeWon sets status WON and preserves phase without accepting manual commission', async () => {
    const opp = await prisma.$transaction((tx) =>
      createOpportunity(tx, {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        leadSource: LeadSourceChannel.ORGANIC,
        customerName: 'Zwycięski Klient',
        initialPhase: PipelinePhase.DELIVERY,
        actor: { type: PipelineActorType.USER },
      })
    );

    const won = await prisma.$transaction((tx) =>
      closeWon(tx, {
        id: opp.id,
        actor: { type: PipelineActorType.USER },
      })
    );

    expect(won.status).toBe(OpportunityStatus.WON);
    expect(won.wonAt).not.toBeNull();
    expect(won.phase).toBe(PipelinePhase.DELIVERY); // Phase preserved

    const wonEvent = await prisma.pipelineEvent.findFirst({
      where: {
        opportunityId: opp.id,
        type: 'OPPORTUNITY_WON',
      },
    });
    expect(wonEvent).toBeDefined();
    expect((wonEvent?.payload as any)?.phase).toBe(PipelinePhase.DELIVERY);
  });

  it('closeLost sets status LOST, requires valid dictionary reason and preserves phase', async () => {
    const opp = await prisma.$transaction((tx) =>
      createOpportunity(tx, {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        leadSource: LeadSourceChannel.ORGANIC,
        customerName: 'Utracony Klient',
        initialPhase: PipelinePhase.SELECTION,
        actor: { type: PipelineActorType.USER },
      })
    );

    // Invalid reason code rejected
    await expect(
      prisma.$transaction((tx) =>
        closeLost(tx, {
          id: opp.id,
          reasonCode: 'INVALID_NON_EXISTENT_REASON',
          actor: { type: PipelineActorType.USER },
        })
      )
    ).rejects.toThrow(/Nieprawidłowy powód odrzucenia/i);

    // Valid reason code accepted
    const lost = await prisma.$transaction((tx) =>
      closeLost(tx, {
        id: opp.id,
        reasonCode: 'CUST_TERMS_REJECTED',
        comment: 'Klient znalazł tańsze auto u konkurencji',
        actor: { type: PipelineActorType.USER },
      })
    );

    expect(lost.status).toBe(OpportunityStatus.LOST);
    expect(lost.lostAt).not.toBeNull();
    expect(lost.lostReasonCode).toBe('CUST_TERMS_REJECTED');
    expect(lost.lostComment).toBe('Klient znalazł tańsze auto u konkurencji');
    expect(lost.phase).toBe(PipelinePhase.SELECTION); // Phase preserved

    const lostEvent = await prisma.pipelineEvent.findFirst({
      where: {
        opportunityId: opp.id,
        type: 'OPPORTUNITY_LOST',
      },
    });
    expect(lostEvent).toBeDefined();
    expect((lostEvent?.payload as any)?.reasonCode).toBe('CUST_TERMS_REJECTED');
  });

  it('handles customer matching ambiguity and unmatchable phone numbers correctly', async () => {
    // 1. Create two customers with identical phone (e.g. legacy data)
    const duplicatePhone = `+48999${Math.floor(100000 + Math.random() * 900000)}`;
    await prisma.pipelineCustomer.createMany({
      data: [
        {
          scopeType: PLATFORM_SCOPE.scopeType,
          scopeId: PLATFORM_SCOPE.scopeId,
          fullName: 'Osoba A',
          phone: duplicatePhone,
        },
        {
          scopeType: PLATFORM_SCOPE.scopeType,
          scopeId: PLATFORM_SCOPE.scopeId,
          fullName: 'Osoba B',
          phone: duplicatePhone,
        },
      ],
    });

    // Match attempt on duplicate phone must report ambiguous and create a new customer
    const ambiguousMatch = await prisma.$transaction((tx) =>
      findOrCreateCustomer(tx, {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        fullName: 'Nowy Klient C',
        phone: duplicatePhone,
      })
    );

    expect(ambiguousMatch.isAmbiguous).toBe(true);
    expect(ambiguousMatch.isNew).toBe(true);
    expect(ambiguousMatch.customer.fullName).toBe('Nowy Klient C');

    // 2. Unmatchable phone (e.g. 000000000) does not match another customer with 000000000
    const cust1 = await prisma.$transaction((tx) =>
      findOrCreateCustomer(tx, {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        fullName: 'Anonim 1',
        phone: '000000000',
      })
    );

    const cust2 = await prisma.$transaction((tx) =>
      findOrCreateCustomer(tx, {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        fullName: 'Anonim 2',
        phone: '000000000',
      })
    );

    expect(cust1.customer.id).not.toBe(cust2.customer.id);
  });
});
