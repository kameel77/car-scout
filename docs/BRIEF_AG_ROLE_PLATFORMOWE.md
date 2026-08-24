# Brief dla agenta — przebudowa ról platformowych (Manager Platformy + Content Manager)

Data: 2026-08-24 · Repo: `car-scout` · Zatwierdził: Kamil

Skopiuj wszystko poniżej linii jako zadanie dla agenta.

---

## Cel biznesowy

Rozdzielić panel administracyjny na dwie niezależne odpowiedzialności operacyjne, tak żeby dało
się bezpiecznie wpuścić do panelu osoby spoza zespołu produktowego:

- **Manager Platformy** — flota i sprzedaż: pojazdy, specyfikacje, oferty, import, najem, sieć
  dealerska, leady, analityka.
- **Content Manager** — treść i marketing: SEO, tłumaczenia, FAQ, treści CMS, landing page'e,
  bannery, kafle, widgety, reklamy partnerskie.
- **Super Admin** — bez zmian: wszystko, plus wyłączność na konfigurację platformy (finansowanie,
  klucze API, ustawienia) i zarządzanie kontami.

Efekt: możliwość oddania obsługi treści osobie zewnętrznej (copywriter, agencja SEO) bez dawania
jej dostępu do leadów, cen i floty — i odwrotnie.

## Decyzje podjęte — nie renegocjuj

| Moduł (menu) | Ścieżka | Super Admin | Manager Platformy | Content Manager |
|---|---|:---:|:---:|:---:|
| Dashboard | `/admin/dashboard` | ✅ | ✅ | ✅ |
| Leady | `/admin/leads` | ✅ | ✅ | ❌ |
| Pojazdy | `/admin/listings` | ✅ | ✅ | ❌ |
| Specyfikacje | `/admin/specifications` | ✅ | ✅ | ❌ |
| Import | `/admin/import` | ✅ | ✅ | ❌ |
| Analytics | `/admin/analytics` | ✅ | ✅ | ❌ |
| Pojazdy najmu | `/admin/rental-vehicles` | ✅ | ✅ | ❌ |
| Firmy najmowe | `/admin/rental-companies` | ✅ | ✅ | ❌ |
| Matryca najmu | `/admin/rental-matrix` | ✅ | ✅ | ❌ |
| Grupy dealerskie | `/admin/dealer-groups` | ✅ | ✅ | ❌ |
| Dealerzy | `/admin/dealers` | ✅ | ✅ | ❌ |
| Tłumaczenia | `/admin/translations` | ✅ | ❌ | ✅ |
| SEO | `/admin/seo` | ✅ | ❌ | ✅ |
| FAQ | `/admin/faq` | ✅ | ❌ | ✅ |
| Treści SEO | `/admin/seo-content` | ✅ | ❌ | ✅ |
| Reklamy partnerskie | `/admin/partners` | ✅ | ❌ | ✅ |
| Widgety | `/admin/widgets` | ✅ | ❌ | ✅ |
| Kafle home | `/admin/feature-tiles` | ✅ | ❌ | ✅ |
| Banery hero | `/admin/hero-banners` | ✅ | ❌ | ✅ |
| Landing Pages | `/admin/landing-pages` | ✅ | ❌ | ✅ |
| Użytkownicy | `/admin/users` | ✅ | ❌ | ❌ |
| Finansowanie | `/admin/financing` | ✅ | ❌ | ❌ |
| Klucze API | `/admin/api-partners` | ✅ | ❌ | ❌ |

Zmiany względem dzisiaj: Manager Platformy **traci** Użytkowników, Finansowanie, Klucze API oraz
cały blok treści/SEO/marketingu. Role dealerskie (`DEALER_GROUP_ADMIN`, `DEALER_ADMIN`,
`DEALER_EMPLOYEE`) zachowują dzisiejszy zakres — nie ruszaj ich zakresu funkcjonalnego.

## Stan obecny — zweryfikowany w kodzie

W repo współistnieją **trzy** mechanizmy autoryzacji, częściowo sprzeczne:

1. `requirePermission('perm')` — `backend/src/middleware/permissions.ts`, oparte o `Membership`.
   Docelowy mechanizm. Używany tylko w `users.ts`, `dealers-admin.ts`, `dealer-groups.ts`.
2. `requirePlatformRole()` — `backend/src/middleware/authorize.ts`. Przepuszcza superadmina
   **i** managera platformy. Chroni: `seo`, `seo-content`, `faq`, `translations`, `partners`,
   `specifications`, część `financing`.
3. `authorizeRoles(['admin'])` — legacy, sprawdza string `user.role`, który przyjmuje tylko dwie
   wartości (`'admin'` dla superadmina, `'manager'` dla **wszystkich pozostałych**, patrz
   `users.ts:167`). Chroni: `landing-pages` (11×), `financing` (7×), `hero-banners` (6×),
   `feature-tiles` (6×), `settings` (5×), `csflow` (5×), `widgets` (4×), `partnerAds` (4×),
   `featured` (2×).

Cztery defekty, które trzeba naprawić przy okazji — bez nich zmiana ról jest kosmetyką menu:

- **D1 — guard tras frontendowych nie działa.** W `src/App.tsx` wszystkie trasy admina mają
  `allowedRoles={['admin','manager']}`, a `ProtectedRoute` mapuje `DEALER_EMPLOYEE` → `'manager'`.
  Skutek: pracownik pojedynczego dealera otwiera każdą stronę panelu, łącznie z Landing Pages
  i Grupami dealerskimi. Blokuje go dopiero (albo i nie) API.
- **D2 — menu kłamie.** `AdminSidebar` pokazuje managerowi platformy Landing Pages, Banery hero,
  Kafle home, Widgety, Reklamy partnerskie i Finansowanie, a te endpointy są za
  `authorizeRoles(['admin'])` → klik kończy się 403. To istnieje dziś, przed naszą zmianą.
- **D3 — brak guardów roli na kluczowych zasobach.** `leads.ts`, `listings.ts`, `import.ts`,
  `analytics.ts`, `rental-vehicles.ts`, `rental-companies.ts`, `rental-matrix.ts` mają wyłącznie
  `fastify.authenticate`. Po dodaniu Content Managera oznaczałoby to, że przez API czyta leady
  i edytuje pojazdy, mimo że nie widzi tych pozycji w menu. **To jest właściwy powód, dla którego
  ten etap musi wejść razem z rolami.**
- **D4 — liniowa hierarchia ról.** `ROLE_PRIORITY` / `ROLE_HIERARCHY` / `roleAtLeast()` zakładają
  porządek „wyżej = więcej". Content Manager nie jest ani wyżej, ani niżej od Managera Platformy —
  jest obok. Model musi przestać być liniowy.

## Model docelowy

### 1. Nowa rola

Dodaj do `enum MemberRole` w `backend/prisma/schema.prisma` wartość `CONTENT_MANAGER_PLATFORM`
(nazwa symetryczna do `SUPERADMIN_PLATFORM`). Rola występuje wyłącznie w scope `PLATFORM`.

Migracja Postgresa: `ALTER TYPE "MemberRole" ADD VALUE 'CONTENT_MANAGER_PLATFORM';` musi być
w **osobnej migracji** niż jakikolwiek kod, który tej wartości używa (Postgres nie pozwala użyć
nowej wartości enuma w tej samej transakcji, w której została dodana).

### 2. Uprawnienia

Rozszerz `Permission` w `backend/src/middleware/permissions.ts`:

```ts
| 'rental:read' | 'rental:write'      // pojazdy najmu
| 'rental:config:write'               // firmy najmowe, matryca najmu
| 'analytics:read'
| 'content:read' | 'content:write'    // SEO, tłumaczenia, FAQ, CMS, LP, bannery, kafle, widgety, reklamy
```

**Świadoma decyzja: `content:*` jest gruboziarniste** — jedno uprawnienie na wszystkie dziewięć
modułów treści. Mamy dokładnie jedną rolę contentową i żadnego wymagania, żeby ktoś edytował FAQ
bez landing page'y. Nie rozbijaj tego na `content:seo:write`, `content:faq:write` itd. — to
konfigurowalność, o którą nikt nie prosił. Jeśli kiedyś pojawi się potrzeba, rozbicie jednego
uprawnienia na kilka jest zmianą lokalną.

Docelowa macierz `ROLE_PERMISSIONS`:

| Permission | SUPERADMIN | PLATFORM_MANAGER | CONTENT_MANAGER | GROUP_ADMIN | DEALER_ADMIN | EMPLOYEE |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `platform:settings:read/write` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users:read/write` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| `dealer_groups:read/write` | ✅ | ✅ | ❌ | read | ❌ | ❌ |
| `dealers:read/write` | ✅ | ✅ | ❌ | ✅ | read | ❌ |
| `stock:read/write/import` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `rental:read/write` | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `rental:config:write` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `leads:read/write` | ✅ | ✅ | ❌ | ✅ | ✅ | read |
| `analytics:read` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `content:read/write` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `context:switch` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### 3. Koniec z liniową hierarchią (naprawa D4)

`getEffectiveRole()` zwraca **jedną** rolę o najwyższym priorytecie. Dla użytkownika, który ma
jednocześnie członkostwo `PLATFORM_MANAGER` i `CONTENT_MANAGER_PLATFORM`, zwróci
`PLATFORM_MANAGER` i cicho odbierze mu uprawnienia contentowe. To nie jest hipotetyczne — Kamil
będzie chciał nadać komuś obie role.

Zmiana: `hasPermission()` liczy **sumę uprawnień wszystkich członkostw pasujących do aktywnego
kontekstu**, zamiast pytać o jedną rolę efektywną:

```ts
export function getEffectivePermissions(
    memberships: MembershipInfo[],
    activeContext: ActiveContext
): Set<Permission> {
    const matching = memberships.filter(/* dzisiejsza logika dopasowania scope */);
    const out = new Set<Permission>();
    for (const m of matching) for (const p of ROLE_PERMISSIONS[m.role] ?? []) out.add(p);
    return out;
}
```

`getEffectiveRole()` **zostaje**, ale wyłącznie do dwóch rzeczy: wyliczania zasięgu danych
(`buildScopeFilter`) i etykiety roli w UI. Dodaj to jako komentarz w kodzie, żeby nikt nie wrócił
do używania go do autoryzacji.

**Uwaga krytyczna:** `PLATFORM_ROLES` (zbiór w `permissions.ts` i w `AuthContext.tsx`) steruje
`buildScopeFilter()` i `getAccessibleDealerIds()` — członkostwo w tym zbiorze oznacza
**nieograniczony dostęp do danych wszystkich dealerów**. `CONTENT_MANAGER_PLATFORM` **nie może**
tam trafić. Dopisz w `ROLE_PRIORITY` (po `PLATFORM_MANAGER`, przed `DEALER_GROUP_ADMIN`) tylko
na potrzeby etykiety. Sprawdź każde miejsce, gdzie `PLATFORM_ROLES` jest używane, zanim cokolwiek
dopiszesz.

### 4. Jedno źródło prawdy dla frontendu

Dziś macierz uprawnień jest zduplikowana: `ROLE_PERMISSIONS` w backendzie i `visibleTo: MemberRole[]`
w `AdminSidebar.tsx`. Przy trzech rolach platformowych ta duplikacja zacznie się rozjeżdżać.

Backend zwraca wyliczoną listę uprawnień, frontend jej tylko używa:

- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/context` dokładają do odpowiedzi
  `permissions: Permission[]` (wyliczone z członkostw i aktywnego kontekstu).
- **Nie wkładaj `permissions` do JWT** — token puchnie i zawiera nieświeże dane po zmianie roli.
  Autoryzacja po stronie API i tak liczy uprawnienia z członkostw przy każdym żądaniu; lista
  w odpowiedzi służy **wyłącznie** do rysowania UI.
- Frontend usuwa własną kopię macierzy.

## Zakres prac — etapy z weryfikacją

Pracuj etapami, każdy zamykaj weryfikacją. Nie łącz etapów 1–3 w jeden commit.

**Etap 1 — model i macierz (backend)**
Enum w Prismie + migracja (osobna), rozszerzony `Permission`, nowa `ROLE_PERMISSIONS`,
`getEffectivePermissions()`, komentarze przy `getEffectiveRole()` i `PLATFORM_ROLES`.
→ weryfikacja: `cd backend && npm run build` przechodzi; nowe testy jednostkowe macierzy (etap 6)
kompilują się i przechodzą.

**Etap 2 — guardy na routach (backend)**
Zamień wszystkie `authorizeRoles([...])` i `requirePlatformRole()` na `requirePermission(...)`
i dołóż guardy tam, gdzie ich nie ma:

| Plik | Dziś | Docelowo |
|---|---|---|
| `routes/leads.ts` | tylko `authenticate` (1 endpoint z 6) | `leads:read` na `GET /api/leads` |
| `routes/listings.ts` | tylko `authenticate` | `stock:read` / `stock:write` |
| `routes/specifications.ts` | `requirePlatformRole()` | `stock:write` |
| `routes/import.ts` | tylko `authenticate` | `stock:import` |
| `routes/csflow.ts` | `authorizeRoles(['admin'])` ×5 | `stock:import` |
| `routes/featured.ts` | `authorizeRoles(['admin'])` ×2 | `stock:write` |
| `routes/analytics.ts` | tylko `authenticate` | `analytics:read` |
| `routes/rental-vehicles.ts` | tylko `authenticate` | `rental:read` / `rental:write` |
| `routes/rental-companies.ts` | tylko `authenticate` | `rental:read` / `rental:config:write` |
| `routes/rental-matrix.ts` | tylko `authenticate` | `rental:read` / `rental:config:write` |
| `routes/translations.ts` | `requirePlatformRole()` ×2 | `content:write` |
| `routes/seo.ts` | `requirePlatformRole()` | `content:write` |
| `routes/seo-content.ts` | `requirePlatformRole()` ×4 | `content:read` / `content:write` |
| `routes/faq.ts` | `requirePlatformRole()` ×2 | `content:write` |
| `routes/partners.ts` | `requirePlatformRole()` (addHook) | `content:write` |
| `routes/partnerAds.ts` | `authorizeRoles(['admin'])` ×4 | `content:write` |
| `routes/widgets.ts` | `authorizeRoles(['admin'])` ×4 | `content:write` |
| `routes/feature-tiles.ts` | `authorizeRoles(['admin'])` ×6 | `content:write` |
| `routes/hero-banners.ts` | `authorizeRoles(['admin'])` ×6 | `content:write` |
| `routes/landing-pages.ts` | `authorizeRoles(['admin'])` ×11 | `content:write` |
| `routes/financing.ts` | `authorizeRoles(['admin'])` ×7 + `requirePlatformRole()` ×2 | `platform:settings:write` |
| `routes/settings.ts` | `authorizeRoles(['admin'])` ×5 | `platform:settings:write` |
| `routes/users.ts`, `dealers-admin.ts`, `dealer-groups.ts` | `requirePermission` | bez zmian poza etapem 5 |

Dwie pułapki:
- **Nie dokładaj guardów do endpointów publicznych z założenia.** W `leads.ts` wszystkie pięć
  `POST` (`/api/leads`, `/negotiation`, `/rental`, `/waitlist`, `/quick`) to formularze z serwisu
  i **muszą zostać publiczne**; guard dostaje wyłącznie `GET /api/leads` (linia 509). Zasada ogólna:
  guard dokładaj tam, gdzie `fastify.authenticate` już jest, albo gdzie jednoznacznie widzisz
  endpoint panelowy. Przy wątpliwości co do konkretnego endpointu — wypisz go i zapytaj, nie zgaduj.
- **Klucze API**: nie znalazłem pliku route dla `/admin/api-partners`. Ustal, którego endpointu
  używa `src/pages/admin/ApiPartnersPage.tsx`, i obejmij go `platform:settings:write`.

Po zamianie **usuń `authorizeRoles` z `backend/src/middleware/authorize.ts`** wraz z importami —
zostawienie martwej funkcji legacy gwarantuje, że ktoś jej znowu użyje. `requirePlatformRole()`
zostaje tylko jeśli po etapie 2 ma jeszcze jakiegokolwiek konsumenta; jeśli nie — też usuń,
razem z jego testami.
→ weryfikacja: `grep -rn "authorizeRoles" backend/src` zwraca pusto; `cd backend && npm test`.

**Etap 3 — API dla frontendu**
`permissions: Permission[]` w odpowiedziach `/api/auth/login`, `/api/auth/me`, `/api/auth/context`.
→ weryfikacja: `curl` na `/api/auth/me` z tokenem superadmina i managera pokazuje różne listy.

**Etap 4 — frontend**
- `AuthContext`: nowa rola w typie `MemberRole` i w `ROLE_LABELS` (etykieta PL: „Content Manager"),
  pole `permissions: Permission[]` z odpowiedzi API, helper `can(p: Permission): boolean`.
  `PLATFORM_ROLES` we froncie — ta sama uwaga co w backendzie, nie dopisuj tam nowej roli
  (`canSwitchContext` musi zostać `false` dla Content Managera).
- `AdminSidebar`: `NavItem.visibleTo: MemberRole[]` → `NavItem.permission: Permission`; filtr
  po `can(item.permission)`. Usuń fallback na `user.role` (`legacyRole === 'admin'` itd.).
- `ProtectedRoute`: nowy prop `permission`, usuń `allowedRoles` i mapowanie legacy (naprawa **D1**).
- `src/App.tsx`: każda trasa `/admin/*` dostaje `permission` zgodnie z tabelą decyzji.
  Dashboard zostaje dostępny dla każdego zalogowanego.
→ weryfikacja: build frontendu; ręczny przegląd menu na czterech kontach (etap 6).

**Etap 5 — zakładanie kont**
- `backend/src/routes/users.ts`: `ASSIGNABLE_ROLES.PLATFORM` = `[SUPERADMIN_PLATFORM,
  PLATFORM_MANAGER, CONTENT_MANAGER_PLATFORM]`. Legacy `user.role` dla nowej roli = `'manager'`
  (pole zostaje wyłącznie dla kompatybilności, nie jest już źródłem autoryzacji).
- Skoro Manager Platformy traci `users:*`, konta platformowe zakłada wyłącznie Super Admin —
  upewnij się, że nadanie roli w scope `PLATFORM` wymaga `platform:settings:write` albo jawnego
  sprawdzenia roli superadmina, a nie samego `users:write` (inaczej admin grupy dealerskiej mógłby
  wyprodukować sobie konto platformowe — sprawdź, czy dzisiejszy kod na to pozwala, i napraw).
- `src/pages/admin/UsersPage.tsx`: nowa pozycja w dropdownie ROLA (linia ~53), `ROLE_LABELS`
  (~65) i `ROLE_COLORS` (~73) — dobierz kolor spójny z istniejącymi (fiolet/niebieski są zajęte).
→ weryfikacja: założenie konta Content Managera z UI kończy się sukcesem i poprawnym menu.

**Etap 6 — testy**
- Test jednostkowy macierzy: dla każdej z 6 ról asercja pełnej listy uprawnień (test zapada się,
  gdy ktoś po cichu doda uprawnienie roli — to jest tu najważniejsze).
- Test `getEffectivePermissions()` dla użytkownika z dwoma członkostwami platformowymi
  (PLATFORM_MANAGER + CONTENT_MANAGER) — suma, nie „wyższa" rola.
- Testy integracyjne authz w konwencji istniejących `partnerAds-authz.test.ts` /
  `widgets-authz.test.ts`: Content Manager dostaje **403** na `POST /api/listings`,
  `GET /api/leads`, `POST /api/import/*`, `GET /api/analytics/*`; Manager Platformy dostaje **403**
  na `POST /api/landing-pages`, `PUT /api/seo/*`, `POST /api/hero-banners`, `PUT /api/settings/*`,
  `POST /api/users`.
- Test regresji D1: `DEALER_EMPLOYEE` nie przechodzi guarda trasy `/admin/landing-pages`.
→ weryfikacja: `cd backend && npm test` na zielono; nowe testy faktycznie zapadają się przy
cofnięciu zmiany w macierzy (sprawdź to — test, który przechodzi zawsze, jest bezwartościowy).

**Etap 7 — wdrożenie**
Migracja enuma → deploy backendu → deploy frontendu. Istniejące konta `PLATFORM_MANAGER`
zachowują rolę, ale tracą dostęp do treści i użytkowników — **nikomu nie nadawaj automatycznie
`CONTENT_MANAGER_PLATFORM`**; przypisanie osób do nowej roli jest decyzją Kamila po wdrożeniu.
Zweryfikuj przed deployem, ilu użytkowników ma dziś `PLATFORM_MANAGER` w scope `PLATFORM`
i wypisz ich e-maile w podsumowaniu — Kamil musi wiedzieć, komu zmienia się panel.

## Czego nie robić

- Nie refaktoruj przy okazji `AdminSidebar` (295 linii), `UsersPage` (716 linii) ani `App.tsx`
  poza tym, co wynika z tego zadania — obowiązuje `CLAUDE.md` §3 (chirurgiczne zmiany).
- Nie wprowadzaj uprawnień per-zasób ani custom-roli konfigurowanych z UI. Nikt o to nie prosił.
- Nie usuwaj pola `User.role` z bazy — jest jeszcze czytane w kilku miejscach; tym zadaniem
  odbieramy mu tylko rolę źródła autoryzacji.
- Nie zmieniaj zakresu ról dealerskich.

## Ryzyka

- **Regresja dostępu u obecnych użytkowników.** Manager Platformy traci sześć modułów naraz.
  Jeśli ktoś z zespołu używa dziś tego konta do wrzucania treści, po wdrożeniu przestanie móc —
  dlatego etap 7 wymaga listy kont przed deployem.
- **Rozjazd guardów.** Jeśli etap 2 zostanie zrobiony niekompletnie, Content Manager będzie miał
  dostęp do danych, których nie widzi w menu. To jest główne ryzyko całego zadania i powód, dla
  którego testy integracyjne z etapu 6 są obowiązkowe, a nie „jeśli starczy czasu".
- **Publiczne endpointy.** Nadgorliwe dokładanie `requirePermission` w `leads.ts` lub `listings.ts`
  zepsuje formularz leada albo listing publiczny na produkcji. Zmiany w tych dwóch plikach
  przejrzyj linia po linii.

## Kryteria akceptacji

1. `grep -rn "authorizeRoles" backend/src` → pusto.
2. Żaden endpoint panelowy nie jest chroniony wyłącznie przez `fastify.authenticate`.
3. Cztery konta testowe (superadmin, manager platformy, content manager, pracownik dealera)
   widzą dokładnie te pozycje menu, które przewiduje tabela decyzji, i **każde kliknięcie
   w widoczną pozycję działa** (koniec z 403 na widocznym module — naprawa D2).
4. Próba wejścia z URL-a na moduł spoza swojego zakresu kończy się przekierowaniem, a nie renderem.
5. `cd backend && npm test` na zielono, z nowymi testami authz.
6. Podsumowanie zawiera listę kont `PLATFORM_MANAGER`, którym zmienia się zakres.
