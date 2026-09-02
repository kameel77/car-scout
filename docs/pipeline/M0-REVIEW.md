# M0 — review

**Verdict: CHANGES REQUESTED.** One blocking defect, two nits, one correction to my own checklist.
Everything else verified and accepted. M1 must not start until §1 is fixed.

Verification was **static** (schema, migration SQL, sources, seed) — the reviewer has no access to the
local Postgres, so the reported `npm test` / `migrate status` results are taken as reported, not confirmed.

---

## 1. BLOCKING — `recordEvent` idempotency recovery cannot work in Postgres

`events/record-event.ts`, the `catch` on `P2002`:

```ts
} catch (err: unknown) {
  if (input.idempotencyKey && (err as { code: string }).code === 'P2002') {
    const existing = await tx.pipelineEvent.findUnique({ ... })   // <-- never returns
```

In PostgreSQL a statement error aborts the enclosing transaction. Every subsequent statement fails with
`25P02 current_transaction_is_aborted`, so this `findUnique` throws instead of recovering. Prisma
interactive transactions do not wrap statements in savepoints, so there is nothing to roll back to.

Consequences:
- the recovery branch is unreachable — it is dead code that reads as a safety net;
- the caller receives a confusing `25P02` instead of `P2002`, so the failure is hard to diagnose;
- **the whole business transaction is lost**, not just the event write.

The pre-check `findUnique` before `create` covers the sequential case, which is why the test passes. It
does not cover the concurrent case — two webhook deliveries in flight at once, which is precisely the
scenario `idempotencyKey` exists for. Retrying webhook deliveries commonly overlap.

### Required fix

Do not catch the conflict. Make the insert non-throwing:

```ts
export async function recordEvent<T extends PipelineEventType>(
  tx: Prisma.TransactionClient,
  input: RecordEventInput<T>
): Promise<string> {
  assertRollupKeys(input);

  const data = { /* …unchanged… */ };

  if (!input.idempotencyKey) {
    const event = await tx.pipelineEvent.create({ data, select: { id: true } });
    return event.id;
  }

  // createMany + skipDuplicates resolves the conflict in the database and never
  // raises, so the surrounding business transaction is never aborted.
  await tx.pipelineEvent.createMany({ data: [data], skipDuplicates: true });
  const event = await tx.pipelineEvent.findUniqueOrThrow({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true },
  });
  return event.id;
}
```

`data` is scalar-only (`opportunityId` / `customerId` are raw FK columns, `payload` is JSON), so
`createMany` accepts it unchanged.

### Required test

Add to `record-event.test.ts` — this is the case the current suite is missing:

```
it('deduplicates concurrent writes with the same idempotencyKey', …)
  → two transactions started concurrently, both calling recordEvent with the same key
  → exactly one row exists
  → both calls resolve, returning the same id
  → neither transaction aborts
```

Assert on all four. A test that only asserts the row count would still pass against the broken version
in the sequential ordering.

---

## 2. Nit — `OFFER_UPDATED` payload is loosely typed

`event-types.ts:96–97` types `before` / `after` as `Record<string, unknown>`. That is the one event whose
entire purpose is a field-level diff, so it is the worst place to lose typing. Narrow it:

```ts
type OfferDiffFields = Pick<PipelineOffer,
  'priceGrosze' | 'downPaymentGrosze' | 'periodMonths' | 'monthlyRateGrosze' |
  'finalPaymentGrosze' | 'annualMileageKm' | 'taxMode' | 'financingType'>;

OFFER_UPDATED: { before: Partial<OfferDiffFields>; after: Partial<OfferDiffFields> };
```

## 3. Nit — `recordEvent` does not enforce the roll-up keys

`EVENTS.md` §2 rule 3 makes `opportunityId` mandatory whenever a case exists, because the whole value of
the table is the two roll-up indexes. Types cannot express that; a runtime invariant can, and it costs
three lines:

```ts
function assertRollupKeys(input: RecordEventInput): void {
  if (input.aggregateType !== 'CUSTOMER' && !input.opportunityId) {
    throw new Error(`recordEvent: ${input.type} requires opportunityId`);
  }
}
```

Without it, the first service that forgets the key produces events invisible to the case timeline, and
nothing fails until someone notices a gap in the history months later.

---

## 4. My mistake, not AG's — the ALTER/DROP acceptance check was wrong

`M0-CHECKLIST.md` §2.1 said the migration must contain no `ALTER TABLE`. Prisma always emits foreign keys
as separate `ALTER TABLE … ADD CONSTRAINT` statements, so a correct additive migration contains them by
construction. All 24 in `20260902170000_pipeline_foundation` are `ADD CONSTRAINT` on tables created in the
same migration; no pre-existing table is touched. **AG was right and the check was wrong.** Corrected in
the checklist; the meaningful check is that no ALTER/DROP names a table outside the module:

```bash
grep -oE '(ALTER TABLE|DROP TABLE) "[a-z_]+"' prisma/migrations/*_pipeline_*/migration.sql \
  | grep -v '"pipeline_'      # must return nothing
```

---

## 5. Verified and accepted

| Check | Result |
|---|---|
| Migration additive; no pre-existing table altered or dropped | ✅ 14 `CREATE TABLE`, 10 `CREATE TYPE`, 38 indexes, 24 `ADD CONSTRAINT`, all on `pipeline_*` |
| FKs point only at `leads`, `listings`, `rental_vehicles`, `users`, `financing_products` | ✅ |
| Existing models changed only by the five inverse relations | ✅ semantic diff vs `dev` is +556 lines, **zero deletions** |
| Immutability trigger matches the specified SQL, incl. `to_jsonb - 'dispatched_at'` | ✅ |
| No `Float` / `BigInt` inside the pipeline block | ✅ (the 33 `Float` in the file are all pre-existing models) |
| `contractSignedAt` / `deliveredAt`, `PipelineCommission → application` relation | ✅ present |
| Named `User` relations (`PipelineOpportunityOwner`, `PipelineTaskAssignee`) | ✅ |
| Event catalogue complete | ✅ 35 types, matches `EVENTS.md` (the report said 28 — the map is right, the count in the report is not) |
| Financiers seeded with code/name/isActive only, no invented criteria | ✅ exactly as instructed |
| Loss reasons: 12 rows, codes and categories as specified | ✅ |
| Seed idempotent | ✅ `upsert` for financiers and loss reasons; `findFirst` + `update`/`create` for requirements, which is idempotent given the nullable columns in their unique keys |
| `seedPipeline` wired unconditionally into `seed.ts` | ✅ not behind a first-run guard |
| No PESEL, ID numbers, or file paths | ✅ |
| `app.ts` untouched in M0 | ✅ |

Two process notes, neither a defect:

- **`prisma format` reformatted the whole schema** — 233 changed lines, semantically zero (`git diff -w`
  shows pure insertions). Harmless here, but it rewrites blame on a 1000-line file. From M1 on, run
  formatting as its own commit so review diffs stay readable.
- **Nothing is committed.** All of M0 sits in the working tree. Commit before starting M1; a milestone
  that cannot be reverted independently is not a milestone.

---

## 6. Schema follow-up (mine, non-blocking, do in M1)

`PipelinePhaseRequirement` has no natural unique key, which is why the seed needs `findFirst` +
`create` rather than `upsert`. Add a `code String` column and `@@unique([scopeType, scopeId, code])`
when M1 touches the schema anyway, and switch the seed to `upsert`.
