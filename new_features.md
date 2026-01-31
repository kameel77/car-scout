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
