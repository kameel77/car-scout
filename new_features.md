# Nowe Funkcjonalności i Usprawnienia

Ten plik służy do zapisywania pomysłów i planowanych usprawnień, które pojawiają się w trakcie rozwoju projektu.

## 1. Funkcjonalności
- [ ] Cena specjalna z zaszyfrowanego parametru `offer` zapisywana w cookie oraz uwzględniana w cenach i kalkulatorze finansowania.
- [ ] Integracje produktów kredytowych (np. Inbank) z modułem finansowania, z możliwością wyboru dostawcy i produktu na karcie oferty przez administratora (lista z priorytetem/warunkami).
- [ ] Moduł konfiguracji połączeń z instytucjami finansowymi (produkcyjne środowiska i klucze API).

## 2. UI i UX
- [ ] Panel administratora: wybór partnera finansowego przy dodawaniu nowego produktu kredytowego (np. Inbank, Produkt własny) wraz z konfiguracją widoczności na karcie oferty.

## 3. Optymalizacje
- [ ] **Optymalizacja zapisu ustawień (Bulk Update)**: Zmiana sposobu aktualizacji cen ofert w `recalculateAllPrices` na zapytanie zbiorcze, aby uniknąć problemów z wydajnością przy dużej liczbie ofert.
- [ ] **Przetwarzanie w tle dla ciężkich operacji**: Przeniesienie długotrwałych procesów (jak przeliczanie wszystkich cen) do kolejki zadań w tle (np. BullMQ/Redis), aby nie blokować interfejsu administratora.
