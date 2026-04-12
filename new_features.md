# Nowe Funkcjonalności i Usprawnienia

Ten plik służy do zapisywania pomysłów i planowanych usprawnień, które pojawiają się w trakcie rozwoju projektu.

## 1. Funkcjonalności
- [ ] Cena specjalna z zaszyfrowanego parametru `offer` zapisywana w cookie oraz uwzględniana w cenach i kalkulatorze finansowania.
- [ ] Integracje produktów kredytowych (np. Inbank) z modułem finansowania, z możliwością wyboru dostawcy i produktu na karcie oferty przez administratora (lista z priorytetem/warunkami).
- [ ] Moduł konfiguracji połączeń z instytucjami finansowymi (produkcyjne środowiska i klucze API).
- [x] Integracja VASH (Vehis Tools) do kalkulacji leasingu dla pojazdów zewnętrznych, działająca równolegle do produktów własnych i Inbank (pobieranie subjectId, zakresów wykupu/opłaty wstępnej i kalkulacji rat).
- [ ] Integracja CRM/CMS: link z zaszyfrowanym UUID klienta (i parametrami kalkulatora) + cookie zbierające odwiedzane URL-e z timestampami + API do odczytu danych dla CMS.

## 2. UI i UX
- [ ] Panel administratora: wybór partnera finansowego przy dodawaniu nowego produktu kredytowego (np. Inbank, Produkt własny) wraz z konfiguracją widoczności na karcie oferty.

## 3. Optymalizacje
- [ ] **Optymalizacja zapisu ustawień (Bulk Update)**: Zmiana sposobu aktualizacji cen ofert w `recalculateAllPrices` na zapytanie zbiorcze, aby uniknąć problemów z wydajnością przy dużej liczbie ofert.
- [ ] **Przetwarzanie w tle dla ciężkich operacji**: Przeniesienie długotrwałych procesów (jak przeliczanie wszystkich cen) do kolejki zadań w tle (np. BullMQ/Redis), aby nie blokować interfejsu administratora.

## 4. Zrealizowane
- [x] **Nowa struktura URL dla ofert**: Zmiana URL-i z `/listing/:id` na format SEO-friendly: `/oferta/marka-model-trim-rocznik-typ-paliwo-id_ogloszenia`. Wdrożone w branchu `new-url` (2025-01-30).
- [x] **Hierarchiczna architektura URL z typem finansowania (SEO)**: Rozszerzenie URL o prefix finansowy (`/leasing/`, `/kredyt-samochodowy/`, `/oferta/`). Canonical tag zapobiega duplikatom, meta title wzbogacony o kontekst (np. „Leasing — BMW 3 Series 2024"), dynamiczny breadcrumb, kontekst zachowany w CTA linkach. Wdrożone 2026-04-11.
- [ ] **Multi-tenant RBAC i kontekst organizacyjny**: wdrożenie hierarchii `platforma -> grupa dealerska -> dealer`, nowych ról (`superadmin_platform`, `platform_manager`, `dealer_group_admin`, `dealer_admin`, `dealer_employee`), tabel `DealerGroup` i `Membership`, oraz filtrowania danych po scope.
- [ ] **Owner pojazdu i tryb kontaktu**: przypisanie oferty do dealera oraz opcjonalnego opiekuna (pracownika dealera), z przełączaniem kontaktu `dealer generyczny` vs `pracownik` przy publikacji i imporcie CSV.

- 2026-04-01: Rozbudować panel admina o dedykowany widok/filtry dla leadów typu `price_negotiation` (priorytety, SLA, statusy negocjacji i szablony odpowiedzi).
