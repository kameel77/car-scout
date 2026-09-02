import { Prisma, ScopeType, PipelineActorType } from '@prisma/client';
import { AggregateType, PipelineEventPayloadMap, PipelineEventType } from './event-types';

export const PLATFORM_SCOPE = { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' } as const;

export type RecordEventInput<T extends PipelineEventType = PipelineEventType> = {
  scopeType: ScopeType;
  scopeId: string;
  type: T;
  aggregateType: AggregateType;
  aggregateId: string;
  opportunityId?: string | null;
  customerId?: string | null;
  actor: {
    type: PipelineActorType;
    userId?: string | null;
    label?: string | null;
  };
  payload: PipelineEventPayloadMap[T];
  occurredAt?: Date;
  correlationId?: string | null;
  causationEventId?: string | null;
  idempotencyKey?: string | null;
};

export function assertRollupKeys(input: RecordEventInput): void {
  if (input.aggregateType !== 'CUSTOMER' && !input.opportunityId) {
    throw new Error(`recordEvent: ${input.type} requires opportunityId`);
  }
}

export async function recordEvent<T extends PipelineEventType>(
  tx: Prisma.TransactionClient,
  input: RecordEventInput<T>
): Promise<string> {
  assertRollupKeys(input);

  const data: Prisma.PipelineEventCreateManyInput = {
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    type: input.type,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    opportunityId: input.opportunityId ?? null,
    customerId: input.customerId ?? null,
    actorType: input.actor.type,
    actorUserId: input.actor.userId ?? null,
    actorLabel: input.actor.label ?? null,
    payload: input.payload as unknown as Prisma.InputJsonValue,
    occurredAt: input.occurredAt ?? new Date(),
    correlationId: input.correlationId ?? null,
    causationEventId: input.causationEventId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
  };

  if (!input.idempotencyKey) {
    const event = await tx.pipelineEvent.create({
      data,
      select: { id: true },
    });
    return event.id;
  }

  // createMany + skipDuplicates resolves the conflict in the database and never
  // raises, so the surrounding business transaction is never aborted.
  await tx.pipelineEvent.createMany({
    data: [data],
    skipDuplicates: true,
  });

  const event = await tx.pipelineEvent.findUniqueOrThrow({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true },
  });

  return event.id;
}
