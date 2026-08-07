# FOTON — zweryfikowane specyfikacje modeli

**Źródło:** wyłącznie fotonpolska.com.pl (Power Truck Poland Sp. z o.o.), pobrane 2026-08-07.
**Zasada:** wolno użyć w treści serwisu wyłącznie wartości z tego dokumentu.
Pole oznaczone „— brak danych" zostaje **puste na stronie**. Nie uzupełniać z wiedzy ogólnej,
nie wnioskować z podobnych modeli, nie zaokrąglać „w górę".

⚠️ Materiały importera są miejscami niekompletne i wewnętrznie sprzeczne. Docelowo należy
wystąpić do Power Truck Poland o oficjalny arkusz danych technicznych dla agentów — publiczna
strona nie wystarcza do zbudowania siedmiu stron modeli.

---

## PICKUPY

### Tunland G7 — https://fotonpolska.com.pl/pickup/tunland-g7/

| Pole | Wartość |
|---|---|
| Napęd | Silnik wysokoprężny AVL, **119 kW / 390 Nm**, Common Rail Bosch III gen. |
| Pojemność skokowa | — brak danych *(nie pisać „2.0")* |
| Zużycie | ok. 7,5 l/100 km |
| Skrzynia | ZF 8AT |
| Napęd/terenowy | 4WD BorgWarner (2H/AUTO/4H/4L), blokada tylnego dyferencjału Eaton, turbo VGT V gen. |
| Bezpieczeństwo | 6 poduszek, kamera 360°, BSD, FCW, DOW, BOS, LCA, HBB |
| Wnętrze | ekran 10,25", LCD 8", hałas 47 dB |
| Wymiary | 5340 × 1940 × 1870 mm, rozstaw 3110 mm |
| Uciąg / ładowność | — **brak danych** |

### Tunland V9 — https://fotonpolska.com.pl/pickup/tunland-v9/

| Pole | Wartość |
|---|---|
| Napęd | 2.0 turbodiesel **AUCAN** + układ **48V mild hybrid** |
| Moc / moment | 163 + 12 KM · 400 + 50 Nm (sekcja AUCAN podaje łącznie 120 kW / 450 Nm) |
| Przyspieszenie | 0–100 km/h poniżej 13 s |
| Skrzynia | ZF 8AT |
| Napęd/terenowy | 4×4, **elektroniczna blokada dyferencjału na obu osiach**, 6 trybów: Eco, Sport, Normal, Piasek, Błoto, Śnieg |
| Bezpieczeństwo | 6 poduszek, belki 1500 MPa, ACC, AEB, LKA, FCW, LDW, DMS, BSD, kamera 360°, poziom **L2.5** |
| Crash-test | **5 gwiazdek C-NCAP** ⚠️ nie mylić z Euro NCAP |
| Wnętrze | ekran 14,6", klimatyzacja dwustrefowa, fotele podgrzewane i wentylowane z pamięcią |
| Wymiary | 5617 × 2090 × 1955 mm, rozstaw 3355 mm |
| Gwarancja | 5 lat / 200 000 km |
| Zawieszenie | — **brak danych** *(nie pisać „wielowahaczowe")* |

---

## DOSTAWCZE (N1)

### eToano Pro — https://fotonpolska.com.pl/van-furgon/etoano-pro/

| Pole | Wartość |
|---|---|
| Napęd | elektryczny, **184 KM** |
| Bateria | 100 kWh |
| Zasięg | **do 357 km (WLTP)** |
| Ładowanie | AC Typ 2, DC CCS2; DC 20–80% ok. 40 min; AC ok. 9 h |
| Przestrzeń ładunkowa | **do 10,4 m³** ⚠️ meta importera podaje 12,4 m³ — rozbieżność, użyć 10,4 |
| Wymiary | standard 5495 × 2000 × 2445/2720 mm; długa 5990 × 2000 × 2445/2720 mm |
| Przestrzeń (wysoki dach) | 3580 × 1775 × 1950 mm |
| Kabina | 3 miejsca, ekran 12,3", klimatyzacja, kamera cofania |
| Wersja pasażerska | konfiguracje 3–18 osób |

⚠️ **Pułapka:** strona zawiera akapit o wersji spalinowej (120 kW, 360 Nm, 8,7 l/100 km).
**Nie przypisywać tych wartości napędowi elektrycznemu.**

### Cavan C1 / C1 Plus / C1 Max — https://fotonpolska.com.pl/cavan/

| Pole | Wartość |
|---|---|
| Napęd | elektryczny, **105 kW (ok. 143 KM) / 210 Nm** |
| Bateria | 50,23 / 66,67 kWh |
| Zasięg | **do 333 km (WLTC)** ⚠️ cykl WLTC, nie WLTP |
| Przestrzeń ładunkowa | 6,8 – 8,5 m³ |
| Prędkość maks. | 120 km/h |
| Wyposażenie | V2L (zasilanie urządzeń z pojazdu), gniazda 230 V w kabinie i przestrzeni ładunkowej, Bluetooth 4.0, OTA, aluminiowa podłoga, drzwi przesuwne |
| Bezpieczeństwo | AEB, ostrzeganie o kolizji czołowej, monitorowanie martwego pola |
| Ładowność / wymiary / DMC / gwarancja | — **brak danych** |

---

## CIĘŻAROWE (N2/N3)

### eMiler — https://fotonpolska.com.pl/emiler/

| Pole | Wartość |
|---|---|
| Napęd | elektryczny; moc i moment — **brak danych** |
| Bateria | CATL LFP, >2800 cykli, chłodzenie cieczą; pojemność kWh — **brak danych** |
| Zasięg | do 180 km (WLTP) |
| Ładowanie | szybkie ok. 1,2 h / wolne ok. 7 h |
| Ładowność | do 2,3 t |
| **DMC** | **4,25 t** ⭐ patrz uwaga niżej |
| Wymiary | 5545 × 1870 × 2080 mm, rozstaw 2900 mm |
| Sprawność napędu | do 96% |
| Prędkość maks. | 90 km/h |
| Gwarancja | akumulatory trakcyjne 5 lat / 200 000 km |

⭐ **DMC 4,25 t — potencjalnie najmocniejszy argument sprzedażowy w całym portfolio.**
Przepisy UE dopuszczają kierowanie pojazdami bezemisyjnymi do 4250 kg na prawie jazdy
kat. **B** (odstępstwo od zasady „powyżej 3,5 t = kat. C"). Jeśli potwierdzi się to dla
polskiej implementacji i dla tego pojazdu, flota nie musi zatrudniać kierowców z kat. C —
to realna oszczędność i rozwiązanie problemu kadrowego.
⚠️ **Wymaga potwierdzenia prawnego przed użyciem w komunikacji.** Nie publikować „na wyczucie".

### eAumark — https://fotonpolska.com.pl/eaumark/

⚠️ **To nie jest jeden pojazd — trzy warianty napędu.** Obecna strona `/foton` traktuje go
jako „elektryczny", co jest uproszczeniem.

| Wariant | Dane |
|---|---|
| **Hybrid (PHEV)** | silnik 2.5L/2.0L + bateria 14 kWh, zasięg ponad 1000 km |
| **Electric (BEV)** | zużycie 32 kWh/100 km, e-axle sprawność ≥96,5%, zasięg do 200 km (WLTP); pojemność baterii — brak danych |
| **Hydrogen** | 80 kW + bateria 30 kWh, zasięg do 450 km, tankowanie 5 min |

| Pole wspólne | Wartość |
|---|---|
| Ładowność | do 4,5 t |
| DMC | 7,5 t |
| Wymiary | 5400 × 2060 × 2300 mm (wydłużony 5960 × 2060 × 2260 mm) |
| Rozstaw osi | 2800 mm (wydłużony 3360 mm) |
| Ładowanie | DC ok. 1 h / AC ok. 5 h |
| Kabina | fotel z amortyzacją pneumatyczną, klimatyzacja 360° (470 m³/h), hałas <65 dB, 23 schowki |
| Gwarancja | akumulatory 5 lat / 200 000 km |

⚠️ **Rozbieżność u importera:** prędkość maksymalna wariantu Hybrid podana raz jako
90 km/h, raz jako 110 km/h. **Nie publikować żadnej z nich** bez potwierdzenia.
⚠️ Wariant wodorowy prawdopodobnie nie jest dostępny handlowo — potwierdzić przed opisaniem.

### Aumark S — https://fotonpolska.com.pl/aumark-s/

⚠️ **To pojazd SPALINOWY (diesel).** Nie może występować w komunikacji o zeroemisyjności,
dostępie do SCT ani dopłatach do elektryków.

| Pole | Wartość |
|---|---|
| Silnik (główny) | Cummins F3.8EVIE156, 3,76 l, **156 KM / 550 Nm**, **Euro VI** |
| Warianty silnika | ISF2.8: 2,776 l, 96–110 kW, 320–360 Nm · ISF3.8: 3,76 l, 105–125 kW, 450–600 Nm |
| Rozstaw osi | 3800 mm |
| Hamulce | pneumatyczne, tarczowe na obu osiach, wspomaganie elektroniczne |
| Bezpieczeństwo | AEBS, LDWS, FCW, ESC, EBS, BSIS, MoIS, DDAWS, ISA, kamera cofania |
| Wyposażenie | klimatyzacja, MP5, Bluetooth, elektryczne szyby, centralny zamek, tempomat ACC |
| Wymiary / ładowność / DMC / gwarancja | — **brak danych** |

---

## Materiały zdjęciowe — status tymczasowy ⚠️

Zdjęcia w `src/data/foton-models.ts` są **hotlinkowane bezpośrednio z fotonpolska.com.pl**.
To rozwiązanie przejściowe, przyjęte świadomie, żeby usunąć z serwisu zdjęcia stockowe
(patrz niżej). Konsekwencje do domknięcia:

- **Zgoda:** potwierdzić z Power Truck Poland prawo do użycia materiałów i zakres CI
- **Trwałość:** zmiana adresów w WordPressie importera zepsuje zdjęcia bez ostrzeżenia
- **Wydajność:** brak kontroli nad rozmiarem, formatem i CDN — ryzyko dla LCP
- **Docelowo:** pobrać pakiet materiałów od importera i hostować u siebie
  (`public/brands/` lub uploads), zachowując tę samą strukturę danych

**Alty pisane własne, nie skopiowane od importera** — importer w części altów nazywa
Tunland G7 „elektrycznym pickupem", choć to diesel.

### Incydent do zapamiętania (2026-08-07)

Pierwsza wersja `/foton` prezentowała **zdjęcia stockowe z Unsplash** — losowe pickupy
i ciężarówki obcych marek podpisane nazwami modeli FOTON. To wprowadzanie w błąd co do
produktu, poważniejsze niż błędne dane techniczne, bo działa natychmiast i wizualnie.
Usunięte. **Zasada na przyszłość: żadnych zdjęć stockowych przy prezentacji konkretnego
produktu — albo zdjęcie tego pojazdu, albo brak zdjęcia.**

---

## Podsumowanie braków

Importer nie podaje: ładowności i wymiarów dla Cavan i Aumark S, mocy silników elektrycznych
eMiler i eAumark BEV, pojemności baterii eMiler i eAumark BEV, kategorii homologacyjnych,
danych o poduszkach i crash-testach dla wszystkich modeli użytkowych.

**Rekomendacja:** wystąpić do Power Truck Poland o arkusz danych technicznych dla agentów.
Do czasu jego otrzymania strony modeli budować z tego, co powyżej, i **zostawiać luki**.
