# Analiza i propozycja wdrożenia modelu multi-tenant (B2B dealer groups)

Data: 2026-03-31

## 1. Stan obecny (na podstawie kodu)

### Auth / role
- System ma **płaski model RBAC** oparty o pole `User.role` jako `string`.
- Aktualnie wykorzystywane role to tylko: `admin`, `manager`.
- JWT niesie jedynie: `userId`, `email`, `role` (bez kontekstu tenantów).
- Middleware `authorizeRoles` sprawdza wyłącznie listę ról, bez filtrowania po dealerze/grupie.

### Model danych
- `Listing` ma opcjonalne `dealerId` i relację do `Dealer`.
- `Dealer` nie ma relacji do `User` ani do pojęcia grupy dealerskiej.
- Brak encji typu `DealerGroup`/`Organization`.
- Brak mapowania użytkownik → dealer/grupa.
- Brak danych „opiekun pojazdu” jako relacji do użytkownika; kontakt jest de facto na poziomie dealera (`Dealer.contactPhone`) i CSV.

### API i UI
- Większość endpointów adminowych działa globalnie (brak izolacji tenantowej).
- `/api/users` jest tylko dla `admin` i nie obsługuje przypisywania do struktury organizacyjnej.
- Frontend ma listy ról zgodne z modelem 2-roli (`admin`, `manager`) i brak przełączania kontekstu tenantu.

## 2. Luka względem wymagań

Wymagane poziomy:
1. `superadmin_platform`
2. `platform_manager`
3. `dealer_group_admin`
4. `dealer_admin`
5. `dealer_employee`

Aktualny system nie zapewnia:
- hierarchii tenantów (platforma → grupa → dealer),
- scope-based authorization (kontekst danych),
- przypisywania użytkowników do wielu kontekstów,
- rozróżnienia kontaktu „dealer generyczny” vs „konkretny pracownik”,
- operacji cross-tenant dla superadmin/manager z kontrolą kontekstu.

## 3. Docelowy model domenowy (propozycja)

## 3.1 Encje i relacje

### A) `DealerGroup` (nowa)
- `id`, `name`, `slug`, `isActive`, `createdAt`, `updatedAt`.

### B) `Dealer` (rozszerzenie)
- dodać: `dealerGroupId` (FK, wymagane po migracji danych),
- zachować obecne pola kontaktowe (name, address, phone, google...) jako „kontakt generyczny firmy”.

### C) `User` (refaktor)
- zostawić dane tożsamościowe (`email`, `name`, `password`, `isActive`),
- przenieść role ze stringa globalnego do członkostw kontekstowych.

### D) `Membership` (nowa, kluczowa)
- tabela łącząca użytkownika z kontekstem i rolą:
  - `userId`
  - `scopeType`: `PLATFORM` | `DEALER_GROUP` | `DEALER`
  - `scopeId` (nullable dla `PLATFORM`)
  - `role`: jedna z 5 ról biznesowych
  - `isDefaultContext` (ułatwia UX)
- unikalność np. (`userId`, `scopeType`, `scopeId`, `role`).

### E) `Listing` (rozszerzenie)
- `dealerId` pozostaje obowiązkowym ownerem biznesowym pojazdu.
- dodać opcjonalne:
  - `ownerUserId` (pracownik/admin dealera odpowiedzialny za pojazd),
  - `contactMode`: `DEALER_GENERIC` | `DEALER_EMPLOYEE`,
  - ewentualnie snapshot kontaktu (`contactName`, `contactPhone`, `contactEmail`) dla stabilności publikacji.

## 3.2 RBAC + scope matrix (uprawnienia)

- `superadmin_platform`: full access + ustawienia globalne + zarządzanie wszystkimi kontekstami.
- `platform_manager`: zarządzanie stockiem, grupami, dealerami, userami (bez krytycznych ustawień platformy jeśli chcesz separacji).
- `dealer_group_admin`: CRUD dealerów i userów tylko we własnej grupie + stock tej grupy.
- `dealer_admin`: CRUD userów i stocku tylko własnego dealera.
- `dealer_employee`: zarządzanie stockiem własnego dealera (bez zarządzania userami).

Wymuszenie: każdy request adminowy musi mieć wyznaczony **effective context** + walidację scope.

## 4. Zmiany architektoniczne w backendzie

1. **JWT claims v2**
   - zachować `userId`,
   - dodać `activeContext`: `{ scopeType, scopeId }`,
   - opcjonalnie `membershipsVersion` do invalidacji sesji.

2. **Nowe middleware autoryzacji**
   - `requirePermission(permission)` zamiast surowego `authorizeRoles`.
   - Permission engine oparty o mapę (rola × akcja × scope).
   - Helper do budowy Prisma `where` z filtrem tenantowym (`dealerId IN ...`).

3. **Refactor endpointów**
   - listingi, leady, import, users, dealer/rental routes: wszystkie endpointy adminowe muszą respektować scope.
   - dodać endpoint switch context, np. `POST /api/auth/context`.

4. **Model administracji organizacją**
   - nowe endpointy:
     - `/api/dealer-groups`
     - `/api/dealers`
     - `/api/memberships`
   - tworzenie kont w ramach grupy/dealera przez role nadrzędne.

5. **Import CSV**
   - przypisanie listingu do dealera wg mappingu/importu,
   - opcjonalny mapping opiekuna (email/login) -> `ownerUserId`,
   - fallback do kontaktu generycznego dealera gdy brak ownera.

## 5. Zmiany w frontendzie (admin panel)

1. **Nowe role i etykiety** (EN/PL/DE).
2. **Context switcher** (dla superadmin / platform_manager):
   - platforma / wybrana grupa / wybrany dealer.
3. **Nowe widoki administracyjne**:
   - grupy dealerskie,
   - dealerzy,
   - członkostwa i użytkownicy per kontekst.
4. **Listing form**:
   - wybór dealera (w dozwolonym scope),
   - wybór trybu kontaktu: generyczny dealer vs opiekun (pracownik).

## 6. Plan migracji etapowej (bezpieczny)

### Etap 1 — Schemat + kompatybilność
- dodać nowe tabele (`DealerGroup`, `Membership`) i pola w `Listing`.
- zachować stare `User.role` tymczasowo jako fallback.

### Etap 2 — Backfill danych
- utworzyć domyślną grupę dealerską (np. `Legacy Group`).
- przypisać istniejących dealerów do tej grupy.
- wygenerować membershipy dla obecnych userów na podstawie `User.role`:
  - `admin` -> `superadmin_platform`
  - `manager` -> `platform_manager`

### Etap 3 — Autoryzacja v2
- przepiąć endpointy na permission engine.
- dodać log audytowy naruszeń scope.

### Etap 4 — UI + operacyjne przełączenie
- wdrożyć context switcher i nowe ekrany.
- ukryć stare role.

### Etap 5 — Cleanup
- usunąć legacy `User.role` po stabilizacji.

## 7. Wydajność i bezpieczeństwo (zgodnie z AGENTS)

- Scope filtrować po stronie SQL/Prisma (`where`), nie w pamięci.
- Dodać indeksy krytyczne:
  - `Listing(dealerId, isArchived, createdAt)`
  - `Membership(userId, scopeType, scopeId)`
  - `Dealer(dealerGroupId)`
- Cache Redis dla wolnozmiennych słowników kontekstowych (dealer groups/dealers).
- Audyt operacji administracyjnych (kto, jaki scope, co zmienił).

## 8. Minimalny zakres MVP (rekomendacja)

1. Wprowadzić `DealerGroup`, `Membership`, nowe role i context switch.
2. Ograniczyć stock/listingi do scope użytkownika.
3. Dodać zarządzanie dealerami i użytkownikami w obrębie scope.
4. Dodać ownera pojazdu (`ownerUserId`) + tryb kontaktu dealer/pracownik.

To już spełnia wymagania biznesowe przy relatywnie niskim ryzyku wdrożeniowym.
