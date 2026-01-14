# Nowe Funkcjonalności i Usprawnienia

Ten plik służy do zapisywania pomysłów i planowanych usprawnień, które pojawiają się w trakcie rozwoju projektu.

## 1. Funkcjonalności
- [ ] Cena specjalna z zaszyfrowanego parametru `offer` zapisywana w cookie oraz uwzględniana w cenach i kalkulatorze finansowania.

## 2. UI i UX
- [ ] (Wkrótce)

## 3. Optymalizacje
- [ ] **Optymalizacja zapisu ustawień (Bulk Update)**: Zmiana sposobu aktualizacji cen ofert w `recalculateAllPrices` na zapytanie zbiorcze, aby uniknąć problemów z wydajnością przy dużej liczbie ofert.
- [ ] **Przetwarzanie w tle dla ciężkich operacji**: Przeniesienie długotrwałych procesów (jak przeliczanie wszystkich cen) do kolejki zadań w tle (np. BullMQ/Redis), aby nie blokować interfejsu administratora.
