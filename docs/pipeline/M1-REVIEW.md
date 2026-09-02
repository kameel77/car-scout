# M1 review — commit `f9e5ad2`

**Verdict: CHANGES REQUESTED.** One blocking security defect (§1), two items to fix (§2), three notes.
Everything from `M1-PLAN-REVIEW.md` was implemented and verified in the source; the blocking item is new
and arrived through a door the plan review did not name.

Verification was static. Test results are as reported, not confirmed — no access to the local Postgres.

---

## 1. BLOCKING — `getPipelineScope` fails open to platform scope

`routes/scope-helper.ts` ends with:

```ts
if (user?.activeContext?.scopeType && user?.activeContext?.scopeId) {
  return { scopeType: ..., scopeId: ... };
}

return PLATFORM_SCOPE;   // <-- fail-open
```

The file's own doc comment states the tenant isolation rule correctly, and the body then breaks it. Any
authenticated request whose token carries no `activeContext` — an older token, a token minted by a path
that does not populate it, a user whose memberships were changed — receives **`PLATFORM` scope**, which
is the highest privilege in the system and matches every tenant's rows.

Today, with one tenant, this is invisible. It becomes a cross-tenant read/write hole on the day a second
tenant exists, and it will not announce itself: nothing errors, the query simply returns more than it
should. A missing scope is an authorization failure, not a default.

### Required fix

```ts
export function getPipelineScope(request: FastifyRequest): { scopeType: ScopeType; scopeId: string } {
  const ctx = (request.user as { activeContext?: { scopeType?: ScopeType; scopeId?: string } })?.activeContext;

  if (!ctx?.scopeType || !ctx?.scopeId) {
    throw request.server.httpErrors.forbidden('No active tenant context');   // 403, never a default
  }
  return { scopeType: ctx.scopeType, scopeId: ctx.scopeId };
}
```

**Test:** a request with a token lacking `activeContext` returns 403 and reads no rows. Add it now — this
is the one test that will still matter in two years.

`PLATFORM_SCOPE` stays where it belongs: seeds and system actors, never request handling.

---

## 2. Should fix

### 2.1 `DEALER_EMPLOYEE` was granted `pipeline:write`

`M1-PLAN-REVIEW.md` §1.4 asked for dealer-level access to be decided deliberately and not granted by
default. Every role in `ROLE_PERMISSIONS` received both `pipeline:read` and `pipeline:write` uniformly,
including `DEALER_EMPLOYEE` — the most restricted role in the system, which deliberately holds
`leads:read` **without** `leads:write`.

As it stands a dealer's employee can create, reassign, transition and close opportunities. Scope
filtering limits *which* rows, but the write capability itself is the wrong default, and in the SaaS
story this is exactly the boundary that will matter.

Proposed, to be confirmed rather than assumed:

| Role | pipeline:read | pipeline:write |
|---|---|---|
| `SUPERADMIN_PLATFORM`, `PLATFORM_MANAGER` | yes | yes |
| `DEALER_GROUP_ADMIN`, `DEALER_ADMIN` | yes | yes |
| `DEALER_EMPLOYEE` | yes | **no** |

### 2.2 Dead code in `getInboxCutoffDate`

```ts
const setting = await prisma.appSettings.findFirst({ select: { siteNamePl: true } });
// Can be extended via AppSettings in the future
```

The row is fetched, the field is unrelated, the result is discarded, and the function falls through to a
hardcoded default. It costs a database round-trip on every inbox load and — worse — reads as though the
cutoff is configurable through AppSettings when it is not. The env var `PIPELINE_INBOX_CUTOFF_DATE`
already works and is sufficient.

Delete the block, or implement the AppSettings path properly. Code that looks like a feature but is not
is more expensive than no code, because the next person builds on the promise.

---

## 3. Verified — everything from the plan review

| Item | Result |
|---|---|
| §1.1 Atomic numbering | ✅ `INSERT … ON CONFLICT (year) DO UPDATE … RETURNING last_value` via `$queryRaw` on the transaction client. Single statement, no recoverable conflict. |
| §1.2 `phaseEnteredAt` reset | ✅ `phase` and `phaseEnteredAt: now` in one `update`; `durationSeconds` measured from the previous `phaseEnteredAt`, event in the same transaction. |
| §1.3 Inbox cutoff | ✅ `createdAt >= cutoff`, env-driven, default `2026-01-01`; `dismissLeadAsSpam` closes as `LOST` / `QUAL_SPAM` with no schema change. |
| §1.4 Auth wiring | ✅ `pipeline:read` / `pipeline:write` in both the backend `Permission` union and `AuthContext`; existing test counts updated, not weakened. Scope defect is §1 above. |
| §2.1 No commission in `closeWon` | ✅ |
| §2.2 `logContact` | ✅ sets `firstContactAt` only on first contact, emits `OPPORTUNITY_FIRST_CONTACT`, updates the next action. |
| §2.3 Customer ambiguity | ✅ >1 match returns `{ match: null, isAmbiguous: true }` — never the first row, never an auto-merge; E.164 normalization and placeholder handling present. |
| No Prisma in routes | ✅ grep over `routes/` returns nothing |
| Scope never from body/query/params | ✅ grep returns nothing |
| Module boundary | ✅ `f9e5ad2` touches 8 files outside the module: `schema.prisma`, `app.ts`, `permissions.ts` (+ its test), `App.tsx`, `AdminSidebar.tsx`, `AuthContext.tsx`, `features_desc.md` |

## 4. Notes, not defects

- **`features_desc.md`** was not on the permitted list, but keeping product documentation current is a
  standing instruction. Accepted; mentioned so the list stays honest.
- **Two unrelated files sit uncommitted on this branch** — `src/components/ImageGallery.tsx` and
  `src/pages/ListingDetailPage.tsx` (reservation/marketing tags on the listing gallery). Not from M1.
  Commit or stash them separately before M2, or they will be swept into a pipeline commit.
- **`changePhase` throws a bare `Error` with a Polish message**, which Fastify will surface as a 500.
  M2 replaces this endpoint's failure mode with the structured 422 from `IMPLEMENTATION.md` §M2.5 —
  fold the change in there rather than patching twice, and move the message to an English error code
  with the Polish text supplied by the UI.

---

## 5. Not yet accepted

M1 is code-complete and, apart from §1, correct. It is **not accepted until the stopwatch runs**: open
`/admin/pipeline`, take a real lead from the inbox to a case with an owner and a due date, with an actual
advisor rather than the person who built it. Under 30 seconds is the acceptance criterion; the test suite
is not a substitute for it. Report the measured time with the fix for §1.

---

## 6. Re-review — fixes accepted, one new finding (commit `3355db1`)

| Item | Verification |
|---|---|
| §1 fail-open scope | ✅ `getPipelineScope` throws; no `PLATFORM_SCOPE` remains anywhere in `routes/` or `services/` except the doc comment. `TenantScopeForbiddenError` carries `statusCode = 403`, there is no custom `setErrorHandler` in `app.ts`, so Fastify honours it. `scope-auth.test.ts` asserts 403 on `/queue` and `/opportunities` with a context-less token. |
| §2.1 `DEALER_EMPLOYEE` | ✅ `pipeline:read` only, mirroring `leads:read`. |
| §2.2 dead AppSettings query | ✅ removed; `getInboxCutoffDate()` is now synchronous. |
| §4.2 unrelated gallery work | ✅ separated into `85dac3d`. |

Minor: the `(request.server as any).httpErrors` branch in `scope-helper.ts` is dead — `@fastify/sensible`
is not a dependency of this project. It never executes, and the two `as any` casts hide that. Delete the
branch and keep the typed `TenantScopeForbiddenError` path, which is what actually runs.

### 6.1 NEW — the qualify modal pre-fills reportable dimensions with guesses

`QualifyLeadModal.tsx`:

```ts
const [clientType, setClientType]       = useState<ClientType>('B2C');
const [financingType, setFinancingType] = useState<FinancingType | ''>('LEASING');
```

Both are constants. (The implementation report states client type is derived from the presence of a NIP
or company name on the lead — it is not; there is no `useEffect` and no reference to `nip` in the file.
Flagged so the record matches the code.)

At qualification the advisor usually does **not** yet know the financing form — establishing it is what
the qualification call is for. Defaulting it to `LEASING` means every case an advisor does not explicitly
correct is silently recorded as leasing. `financingType` is a reporting dimension and the basis of the
product-mix and per-financier analysis that this module exists to produce; a field that looks filled but
carries no information is the spreadsheet pathology in a new coat.

It also has a concrete downstream effect. `financingType` is one of the HARD requirements for entering
`FINANCIAL_DECISION` in M2 (`M0-CHECKLIST.md` §4.3). Pre-filled, that gate is satisfied by a value nobody
chose — the gate passes while the data behind it is fiction. A gate that cannot fail is not a gate.

**Required before advisors use the module, and before the M2 gate is built on it:** both fields start
empty. `financingType` stays optional at qualification (it belongs to the SELECTION phase); `clientType`
may be pre-selected only where it is genuinely derived — a NIP or company name on the lead — and stays
`UNKNOWN` otherwise, which is exactly what the enum's `UNKNOWN` member is for.

Keep the other defaults: current user as owner, next action `CALL_FIRST`, due in 30 minutes. Those are
policy, not guesses about the customer.

### 6.2 The stopwatch is not yet run

The reported 3–5 seconds counts two clicks by the person who built the screen, on a form pre-filled with
the defaults §6.1 removes. That measures the UI, not the task. The acceptance criterion is a real advisor
completing a real qualification — deciding owner, product and date — end to end.

**M1 code is accepted.** Operational acceptance stays open pending §6.1 and one timed run with an advisor.
M2 may start on the backend; do not build the `FINANCIAL_DECISION` gate until §6.1 lands.
