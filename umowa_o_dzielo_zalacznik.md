# ZAŁĄCZNIK NR 1 DO UMOWY O DZIEŁO

## Przedmiot umowy – zakres wdrożenia funkcjonalności aplikacji Car Scout

**Data:** [data zawarcia umowy]  
**Strony:** [Zamawiający] oraz [Wykonawca]

---

## 1. Informacje o projekcie

Aplikacja **Car Scout** to platforma do sprzedaży samochodów składająca się z:
- **Backend:** Fastify, Prisma, PostgreSQL
- **Frontend:** React, Vite, TanStack Query, Shadcn UI
- **Wielojęzyczność:** Obsługa języków PL, DE, EN z systemem synchronizacji tłumaczeń

---

## 2. Zakres wdrożonych funkcjonalności

### 2.1. System cenowy i rabatowy

| Funkcjonalność | Opis |
|---------------|------|
| Cena specjalna (`offer`) | Mechanizm personalizowanej oferty cenowej poprzez parametr URL z zakodowanym rabatem (base64url). Rabat zapisywany w cookie i uwzględniany we wszystkich widokach cen (lista, karta pojazdu, lead, kalkulator finansowania). Tag „Oferta dla Ciebie" na karcie pojazdu. |
| Automatyczne przeliczanie cen | Ceny automatycznie przeliczane przy każdej zmianie ustawień globalnych (marże, kursy walut). |
| Ukrycie znacznika „Najniższa cena z 30 dni" | Usunięcie znacznika z karty oferty (widok mobilny i boczna karta ceny). |

### 2.2. System finansowania i kalkulatory

| Funkcjonalność | Opis |
|---------------|------|
| Produkty kredytowe z integracjami | Moduł zarządzania produktami kredytowymi od wielu partnerów (np. Inbank). Administrator wybiera partnera podczas dodawania produktu. Widoczność produktów konfigurowalna jako lista z priorytetem i warunkami (zakres kwoty finansowania). |
| Integracja Inbank | Obliczanie rat na podstawie wywołań API partnera. Automatyczne przełączenie na produkt własny w przypadku błędu/timeoutu API. |
| Integracja VASH (Vehis Tools) | Kalkulacje leasingowe dla pojazdów zewnętrznych. Pobieranie subjectId, zakresów opłaty wstępnej i wykupu, kalkulacja rat. Autoryzacja przez token, obsługa błędów z fallbackiem na produkt własny. |
| Konfiguracja połączeń | Moduł konfiguracji połączeń z instytucjami finansowymi (środowisko produkcyjne, klucze API, dane logowania). Test połączenia. |

### 2.3. Moduł SEO i URL

| Funkcjonalność | Opis |
|---------------|------|
| Nowa struktura URL | Format SEO-friendly: `/oferta/marka-model-trim-rocznik-typ-paliwo-id_ogloszenia`. Zachowana kompatybilność wsteczna ze starym formatem `/listing/:id`. Automatyczna generacja slug przy imporcie CSV. Transliteracja polskich znaków. |

### 2.4. Panel administratora

| Funkcjonalność | Opis |
|---------------|------|
| Archiwizacja ofert | Ukrywanie pojazdów bez fizycznego usuwania z bazy. Opcje: Archiwizuj, Przywróć, Usuń definitywnie. Etykieta „Archiwalny" na liście. |
| Masowe akcje | Wykonywanie operacji na wielu ofertach jednocześnie (zaznaczanie, archiwizacja, przywracanie, usuwanie). Okna potwierdzenia, powiadomienia o wynikach. |
| Zarządzanie produktami kredytowymi | Wybór partnera finansowego przy dodawaniu produktu, konfiguracja widoczności na karcie oferty. |

### 2.5. Integracja CRM/CMS

| Funkcjonalność | Opis |
|---------------|------|
| Identyfikacja klienta | Link z zaszyfrowanym parametrem `offer` zawierającym UUID klienta z CRM i parametry kalkulatora. |
| Tracking odwiedzin | Zapisywanie w cookie odwiedzanych URL-i z timestampami. |
| API historii | Backend udostępnia API do pobrania historii odwiedzin na podstawie UUID klienta. |

### 2.6. Interfejs użytkownika

| Funkcjonalność | Opis |
|---------------|------|
| Sekcja „Dlaczego my" | Sekcja na stronie oferty nad FAQ z czterema kafelkami z ikonami i opisami. |

### 2.7. System reklam partnerskich (Partner Ads)

| Funkcjonalność | Opis |
|---------------|------|
| Moduł reklam partnerskich | System zarządzania i wyświetlania ofert reklamowych od partnerów na stronie. |
| Panel administratora | Strona `/admin/partners` do tworzenia, edycji i usuwania reklam partnerskich. |
| Miejsca wyświetlania (placements) | Obsługiwane lokalizacje: `SEARCH_GRID` (w siatce wyników), `SEARCH_TOP` (nad wynikami), `DETAIL_SIDEBAR` (sidebar na karcie pojazdu). |
| Konfiguracja reklamy | Pola: tytuł, opis, subtytuł, tekst CTA, URL, zdjęcie (osobne dla mobile/desktop), nazwa partnera/marki, lista cech, priorytet wyświetlania, aktywność, przezroczystość overlay. |
| Wielojęzyczność | Pełna obsługa tłumaczeń (PL, EN, DE) dla tytułów, opisów, subtitłów i tekstów CTA. |
| Tryb graficzny | Opcja `hideUiElements` do ukrycia elementów tekstowych (dla gotowych banerów graficznych). |
| Wyświetlanie na stronie | Komponenty: `PartnerAdCard`, `PartnerBannerAd`, `PartnerSidebarAd` z etykietami „Reklama"/„Partner Offer"/„Anzeige". |
| API | Backendowe endpointy: `GET /api/partner-ads` (publiczne), `GET/POST/PATCH/DELETE /api/admin/partner-ads` (administracyjne). |

---

## 3. Konfiguracja i wdrożenie

### 3.1. Środowisko

| Element | Opis |
|---------|------|
| Backend | Fastify + Prisma + PostgreSQL |
| Frontend | React + Vite + TanStack Query + Shadcn UI |
| Bazy danych | PostgreSQL i Redis jako osobne serwisy |
| Proxy | Odwrócone proxy z ścieżką `/api` |

### 3.2. Zmienne środowiskowe

- `VITE_API_URL` – adres backendu (frontend)
- `FRONTEND_URL`, `VITE_FRONTEND_URL`, `CORS_ORIGINS`, `ALLOWED_ORIGINS` – konfiguracja CORS
- `BACKEND_URL` – adres backendu dla frontendu (konfiguracja Nginx)

---

## 4. Status realizacji

| Funkcjonalność | Status |
|---------------|--------|
| Cena specjalna (`offer`) | ✅ Zaimplementowane |
| Integracja Inbank | ✅ Zaimplementowane |
| Integracja VASH (Vehis Tools) | ✅ Zaimplementowane |
| Nowa struktura URL (SEO) | ✅ Zaimplementowane |
| Archiwizacja ofert | ✅ Zaimplementowane |
| Masowe akcje na ofertach | ✅ Zaimplementowane |
| Integracja CRM/CMS | ✅ Zaimplementowane |
| Sekcja „Dlaczego my" | ✅ Zaimplementowane |
| System reklam partnerskich | ✅ Zaimplementowane |
| Konfiguracja połączeń | ✅ Zaimplementowane |
| Automatyczne przeliczanie cen | ✅ Zaimplementowane |
| Optymalizacja zapisu ustawień (Bulk Update) | ⏳ Planowane |
| Przetwarzanie w tle (BullMQ/Redis) | ⏳ Planowane |

---

## 5. Uwagi

1. Wszystkie funkcjonalności oznaczone jako ✅ Zaimplementowane zostały wdrożone i przetestowane w środowisku developerskim.
2. Funkcjonalności oznaczone jako ⏳ Planowane wymagają dodatkowego wdrożenia i nie są objęte niniejszym zakresem umowy, chyba że strony uzgodnią inaczej.
3. System obsługuje wielojęzyczność (PL, DE, EN) z zachowaniem synchronizacji tłumaczeń.
4. Ceny są automatycznie przeliczane przy zmianie ustawień globalnych (marże, kursy walut).
5. Loga (header/footer) przechowywane w formacie Base64 w tabeli `AppSettings`.

---

**Podpisy:**

| | |
|---|---|
| **Zamawiający** | **Wykonawca** |
| | |
| _________________________ | _________________________ |
| Data: ___________________ | Data: ___________________ |
