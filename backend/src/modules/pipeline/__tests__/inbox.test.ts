import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, PipelineActorType, OpportunityStatus, LeadSourceChannel } from '@prisma/client';
import { listInboxLeads, qualifyLead, dismissLeadAsSpam } from '../services/inbox.service.js';
import { PLATFORM_SCOPE } from '../events/record-event.js';

describe('Inbox & Qualification Service Logic', () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function makeRef() {
    return `REF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  it('filters out leads before cutoff date and leads with linked opportunities', async () => {
    const futureCutoff = new Date('2026-06-01T00:00:00Z');

    // Create old lead before cutoff
    await prisma.lead.create({
      data: {
        referenceNumber: makeRef(),
        name: 'Stary Lead 2024',
        email: 'old@lead.pl',
        phone: '+48111222333',
        message: 'Stare zapytanie',
        createdAt: new Date('2024-12-01T00:00:00Z'),
      },
    });

    // Create new lead after cutoff
    const newLead = await prisma.lead.create({
      data: {
        referenceNumber: makeRef(),
        name: 'Nowy Lead 2026',
        email: 'new@lead.pl',
        phone: '+48222333444',
        message: 'Nowe zapytanie',
        createdAt: new Date(Date.now() + 60000),
      },
    });

    const inbox = await listInboxLeads(prisma, {
      scopeType: PLATFORM_SCOPE.scopeType,
      scopeId: PLATFORM_SCOPE.scopeId,
      cutoffDate: futureCutoff,
    });

    const leadIds = inbox.leads.map((l) => l.id);
    expect(leadIds).toContain(newLead.id);
  });

  it('qualifies a lead into a case with owner and next action', async () => {
    const user = await prisma.user.findFirst();

    const lead = await prisma.lead.create({
      data: {
        referenceNumber: makeRef(),
        name: 'Kamil Testowy',
        phone: '+48600123456',
        email: 'kamil.test@motolia.pl',
        message: 'Chcę ofertę na auto',
        trafficSource: 'facebook_ad_123',
      },
    });

    const opportunity = await prisma.$transaction((tx) =>
      qualifyLead(tx, {
        leadId: lead.id,
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        ownerUserId: user?.id ?? null,
        nextActionType: 'CALL_FIRST',
        nextActionDueAt: new Date(),
        nextActionNote: 'Pierwsza rozmowa',
        actor: { type: PipelineActorType.USER, userId: user?.id, label: 'Kamil' },
      })
    );

    expect(opportunity.id).toBeTruthy();
    expect(opportunity.sourceLeadId).toBe(lead.id);
    expect(opportunity.leadSource).toBe(LeadSourceChannel.META);

    // Lead is now linked and should disappear from inbox
    const inbox = await listInboxLeads(prisma, {
      scopeType: PLATFORM_SCOPE.scopeType,
      scopeId: PLATFORM_SCOPE.scopeId,
      cutoffDate: new Date('2020-01-01'),
    });
    const unlinkedIds = inbox.leads.map((l) => l.id);
    expect(unlinkedIds).not.toContain(lead.id);
  });

  it('qualifying a 2nd lead for matched customer creates a 2nd distinct opportunity', async () => {
    const customerPhone = `+48700${Math.floor(100000 + Math.random() * 900000)}`;

    const lead1 = await prisma.lead.create({
      data: {
        referenceNumber: makeRef(),
        name: 'Jan Dwusamochodowy',
        phone: customerPhone,
        email: 'jan.dwa@example.com',
        message: 'Auto pierwsze',
      },
    });

    const opp1 = await prisma.$transaction((tx) =>
      qualifyLead(tx, {
        leadId: lead1.id,
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        actor: { type: PipelineActorType.USER },
      })
    );

    const lead2 = await prisma.lead.create({
      data: {
        referenceNumber: makeRef(),
        name: 'Jan Dwusamochodowy Drugie Auto',
        phone: customerPhone,
        email: 'jan.dwa@example.com',
        message: 'Auto drugie',
      },
    });

    const opp2 = await prisma.$transaction((tx) =>
      qualifyLead(tx, {
        leadId: lead2.id,
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        actor: { type: PipelineActorType.USER },
      })
    );

    // Both opportunities are distinct rows, linked to the same customer
    expect(opp1.id).not.toBe(opp2.id);
    expect(opp1.number).not.toBe(opp2.number);
    expect(opp1.customerId).toBe(opp2.customerId);
  });

  it('dismissLeadAsSpam creates a case immediately closed as LOST with QUAL_SPAM', async () => {
    const spamLead = await prisma.lead.create({
      data: {
        referenceNumber: makeRef(),
        name: 'Crypto Bot',
        phone: '+48000999888',
        email: 'crypto@spam.com',
        message: 'Spam text',
        trafficSource: 'spam_crawler',
      },
    });

    const spamOpp = await prisma.$transaction((tx) =>
      dismissLeadAsSpam(tx, {
        leadId: spamLead.id,
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        comment: 'Spam formularza kontaktowego',
        actor: { type: PipelineActorType.USER, label: 'Moderator' },
      })
    );

    expect(spamOpp.status).toBe(OpportunityStatus.LOST);
    expect(spamOpp.lostReasonCode).toBe('QUAL_SPAM');
    expect(spamOpp.lostComment).toBe('Spam formularza kontaktowego');
    expect(spamOpp.sourceLeadId).toBe(spamLead.id);
  });
});
