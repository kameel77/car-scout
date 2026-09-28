/**
 * FOTON content for server-side rendering (/foton, /foton/:slug).
 *
 * MIRROR of src/data/foton-models.ts (frontend single source of truth) — the backend
 * Docker build context is ./backend, so it cannot import the frontend file directly.
 * Parity is enforced by src/content/__tests__/foton-content.test.ts: edit the frontend
 * file first, then update this mirror in the same commit.
 */

export interface FotonSeoFaq {
    q: string;
    a: string;
}

export interface FotonSeoModel {
    id: string;
    category: 'fleet' | 'lifestyle';
    categoryLabel: string;
    name: string;
    tagline: string;
    heroParams: string[];
    highlights: string[];
    specs: { label: string; value: string }[];
    faq: FotonSeoFaq[];
    image?: { src: string; alt: string };
}

export const FOTON_SEO_MODELS: FotonSeoModel[] = [
    {
        "id": "tunland-g7",
        "category": "lifestyle",
        "categoryLabel": "Pickup 4x4 · Diesel",
        "name": "FOTON Tunland G7",
        "tagline": "Do pracy i na co dzień",
        "heroParams": [
            "Diesel AVL 119 kW / 390 Nm",
            "Napęd 4WD BorgWarner",
            "Automat ZF 8AT"
        ],
        "highlights": [
            "Silnik wysokoprężny Common Rail Bosch III generacji (zużycie ok. 7,5 l/100 km)",
            "Bezpieczeństwo: 6 poduszek powietrznych, kamera 360°, BSD, FCW, DOW, BOS, LCA",
            "Wnętrze: ekran centralny 10,25\", cyfrowy zegar LCD 8\", poziom hałasu w kabinie 47 dB",
            "Wymiary: 5340×1940×1870 mm, rozstaw osi 3110 mm"
        ],
        "specs": [
            {
                "label": "Napęd",
                "value": "Silnik wysokoprężny AVL, 119 kW / 390 Nm, Common Rail Bosch III generacji"
            },
            {
                "label": "Zużycie paliwa",
                "value": "ok. 7,5 l/100 km"
            },
            {
                "label": "Skrzynia biegów",
                "value": "Automatyczna ZF 8AT"
            },
            {
                "label": "Napęd terenowy",
                "value": "4WD BorgWarner (2H/AUTO/4H/4L), blokada tylnego dyferencjału Eaton, turbo VGT V generacji"
            },
            {
                "label": "Bezpieczeństwo",
                "value": "6 poduszek powietrznych, kamera 360°, BSD, FCW, DOW, BOS, LCA, HBB"
            },
            {
                "label": "Wnętrze",
                "value": "Ekran centralny 10,25\", cyfrowy zegar LCD 8\", poziom hałasu w kabinie 47 dB"
            },
            {
                "label": "Wymiary",
                "value": "5340 × 1940 × 1870 mm, rozstaw osi 3110 mm"
            }
        ],
        "faq": [
            {
                "q": "Jaki napęd ma FOTON Tunland G7?",
                "a": "Tunland G7 napędza silnik wysokoprężny AVL o mocy 119 kW i momencie obrotowym 390 Nm, z wtryskiem Common Rail Bosch III generacji. Średnie zużycie paliwa wynosi ok. 7,5 l/100 km, a moc przekazuje automatyczna skrzynia ZF 8AT."
            },
            {
                "q": "Czy Tunland G7 ma napęd 4x4 i blokady terenowe?",
                "a": "Tak. Pickup wyposażono w system 4WD BorgWarner z trybami 2H/AUTO/4H/4L oraz blokadę tylnego mechanizmu różnicowego Eaton, co ułatwia jazdę w trudnym terenie i przy niskiej przyczepności."
            },
            {
                "q": "Jakie wyposażenie bezpieczeństwa ma Tunland G7?",
                "a": "Pickup oferuje 6 poduszek powietrznych, kamerę 360°, monitorowanie martwego pola (BSD), ostrzeganie o kolizji czołowej (FCW) oraz systemy DOW, BOS i LCA."
            }
        ],
        "image": {
            "src": "https://fotonpolska.com.pl/wp-content/uploads/2026/05/foton-tunland-g7.png",
            "alt": "FOTON Tunland G7 — pickup 4x4 z silnikiem wysokoprężnym, widok reprezentacyjny"
        }
    },
    {
        "id": "tunland-v9",
        "category": "lifestyle",
        "categoryLabel": "Pickup 4x4 · Mild Hybrid 48V",
        "name": "FOTON Tunland V9",
        "tagline": "Pickup z układem 48V Mild Hybrid",
        "heroParams": [
            "Mild Hybrid 48V, 163+12 KM",
            "0–100 km/h poniżej 13 s",
            "5 gwiazdek C-NCAP"
        ],
        "highlights": [
            "Napęd 2.0 turbodiesel AUCAN wspomagany układem 48V Mild Hybrid (163 + 12 KM, 400 + 50 Nm, łącznie 120 kW / 450 Nm)",
            "Przyspieszenie 0–100 km/h poniżej 13 sekund",
            "Elektroniczna blokada mechanizmu różnicowego na obu osiach oraz 6 trybów jazdy: Eco, Sport, Normal, Piasek, Błoto, Śnieg",
            "Bezpieczeństwo: 6 poduszek powietrznych, belki antykolizyjne ze stali 1500 MPa, ACC/AEB/LKA/FCW/LDW/DMS/BSD, kamera 360° (poziom L2.5)",
            "5 gwiazdek w testach bezpieczeństwa C-NCAP"
        ],
        "specs": [
            {
                "label": "Napęd",
                "value": "2.0 turbodiesel AUCAN + układ 48V Mild Hybrid"
            },
            {
                "label": "Moc / moment obrotowy",
                "value": "163 + 12 KM · 400 + 50 Nm (sekcja AUCAN podaje łącznie 120 kW / 450 Nm)"
            },
            {
                "label": "Przyspieszenie 0–100 km/h",
                "value": "poniżej 13 s"
            },
            {
                "label": "Skrzynia biegów",
                "value": "Automatyczna ZF 8AT"
            },
            {
                "label": "Napęd terenowy",
                "value": "4×4, elektroniczna blokada mechanizmu różnicowego na obu osiach; 6 trybów: Eco, Sport, Normal, Piasek, Błoto, Śnieg"
            },
            {
                "label": "Bezpieczeństwo",
                "value": "6 poduszek powietrznych, belki antykolizyjne ze stali 1500 MPa, ACC, AEB, LKA, FCW, LDW, DMS, BSD, kamera 360° (poziom L2.5)"
            },
            {
                "label": "Crash-test",
                "value": "5 gwiazdek C-NCAP"
            },
            {
                "label": "Wnętrze",
                "value": "Ekran 14,6\", dwustrefowa automatyczna klimatyzacja, fotele podgrzewane i wentylowane z pamięcią"
            },
            {
                "label": "Wymiary",
                "value": "5617 × 2090 × 1955 mm, rozstaw osi 3355 mm"
            },
            {
                "label": "Gwarancja",
                "value": "5 lat / 200 000 km"
            }
        ],
        "faq": [
            {
                "q": "Czym różni się napęd Tunland V9 od Tunland G7?",
                "a": "Tunland V9 łączy 2.0 turbodiesla AUCAN z układem 48V Mild Hybrid (163 + 12 KM, 400 + 50 Nm), osiągając 0–100 km/h poniżej 13 sekund. Tunland G7 korzysta z klasycznego silnika wysokoprężnego AVL (119 kW / 390 Nm) bez wspomagania elektrycznego."
            },
            {
                "q": "Jaki wynik osiągnął Tunland V9 w testach zderzeniowych?",
                "a": "Tunland V9 uzyskał 5 gwiazdek w teście C-NCAP — chińskiej procedurze homologacyjnej, odrębnej od standardów stosowanych w Europie Zachodniej. Model wyposażono dodatkowo w system wspomagania kierowcy poziomu L2.5."
            },
            {
                "q": "Jakie tryby jazdy oferuje Tunland V9?",
                "a": "Kierowca może wybrać spośród sześciu trybów: Eco, Sport, Normal, Piasek, Błoto i Śnieg. Pickup ma też elektroniczną blokadę mechanizmu różnicowego na obu osiach, ułatwiającą jazdę w trudnym terenie."
            }
        ],
        "image": {
            "src": "https://fotonpolska.com.pl/wp-content/uploads/2026/04/FOTON-Polska-Tunland-V9-PICKUP-4X4.png",
            "alt": "FOTON Tunland V9 — pickup 4x4 z układem Mild Hybrid 48V, widok reprezentacyjny"
        }
    },
    {
        "id": "etoano-pro",
        "category": "fleet",
        "categoryLabel": "Dostawczy EV · Furgon",
        "name": "FOTON eToano Pro",
        "tagline": "Zeroemisyjny furgon dla logistyki miejskiej",
        "heroParams": [
            "Elektryczny, 184 KM",
            "Zasięg do 357 km (WLTP)",
            "Ładunek do 10,4 m³"
        ],
        "highlights": [
            "Silnik elektryczny o mocy 184 KM oraz bateria o pojemności 100 kWh",
            "Zasięg do 357 km w cyklu WLTP",
            "Przestrzeń ładunkowa do 10,4 m³",
            "Ładowanie: AC Typ 2, DC CCS2 – uzupełnienie 20–80% w ok. 40 min (DC) lub ok. 9 h (AC)",
            "Wymiary: wersja standardowa 5495×2000×2445/2720 mm, wersja długa 5990×2000×2445/2720 mm",
            "3 miejsca siedzące, ekran centralny 12,3\""
        ],
        "specs": [
            {
                "label": "Napęd",
                "value": "Elektryczny, 184 KM"
            },
            {
                "label": "Bateria",
                "value": "100 kWh"
            },
            {
                "label": "Zasięg",
                "value": "do 357 km (WLTP)"
            },
            {
                "label": "Ładowanie",
                "value": "AC Typ 2, DC CCS2; DC 20–80% ok. 40 min; AC ok. 9 h"
            },
            {
                "label": "Przestrzeń ładunkowa",
                "value": "do 10,4 m³"
            },
            {
                "label": "Wymiary",
                "value": "wersja standardowa 5495 × 2000 × 2445/2720 mm; wersja długa 5990 × 2000 × 2445/2720 mm"
            },
            {
                "label": "Przestrzeń ładunkowa (wysoki dach)",
                "value": "3580 × 1775 × 1950 mm"
            },
            {
                "label": "Kabina",
                "value": "3 miejsca, ekran centralny 12,3\", klimatyzacja, kamera cofania"
            },
            {
                "label": "Wersja pasażerska",
                "value": "konfiguracje 3–18 osób"
            }
        ],
        "faq": [
            {
                "q": "Jaki zasięg ma FOTON eToano Pro?",
                "a": "eToano Pro pokonuje do 357 km na jednym ładowaniu w cyklu WLTP, dzięki baterii o pojemności 100 kWh i silnikowi elektrycznemu o mocy 184 KM."
            },
            {
                "q": "Ile trwa ładowanie eToano Pro?",
                "a": "Ładowanie prądem stałym (DC CCS2) uzupełnia baterię z 20% do 80% w ok. 40 minut. Ładowanie prądem zmiennym (AC Typ 2) trwa ok. 9 godzin."
            },
            {
                "q": "Jaka jest pojemność ładunkowa eToano Pro?",
                "a": "Przestrzeń ładunkowa sięga do 10,4 m³, a wersja z wysokim dachem oferuje komorę o wymiarach 3580×1775×1950 mm. Dostępne są wersje standardowa i długa nadwozia."
            }
        ],
        "image": {
            "src": "https://fotonpolska.com.pl/wp-content/uploads/2026/05/foton-etoano.png",
            "alt": "FOTON eToano Pro — elektryczny furgon dostawczy, widok reprezentacyjny"
        }
    },
    {
        "id": "cavan",
        "category": "fleet",
        "categoryLabel": "Kompaktowy Van EV",
        "name": "FOTON Cavan",
        "tagline": "Zwinny van do dystrybucji ostatniej mili",
        "heroParams": [
            "Elektryczny, 105 kW / 210 Nm",
            "Zasięg do 333 km (WLTC)",
            "Ładunek 6,8–8,5 m³"
        ],
        "highlights": [
            "Napęd elektryczny 105 kW (ok. 143 KM) / 210 Nm",
            "Bateria 50,23 lub 66,67 kWh, zasięg do 333 km w cyklu WLTC",
            "Przestrzeń ładunkowa 6,8–8,5 m³, prędkość maks. 120 km/h",
            "V2L (zasilanie urządzeń z pojazdu), gniazda 230 V w kabinie i przestrzeni ładunkowej, aluminiowa podłoga",
            "Bezpieczeństwo: AEB, ostrzeganie o kolizji czołowej, monitorowanie martwego pola"
        ],
        "specs": [
            {
                "label": "Napęd",
                "value": "Elektryczny, 105 kW (ok. 143 KM) / 210 Nm"
            },
            {
                "label": "Bateria",
                "value": "50,23 / 66,67 kWh"
            },
            {
                "label": "Zasięg",
                "value": "do 333 km (cykl WLTC)"
            },
            {
                "label": "Przestrzeń ładunkowa",
                "value": "6,8–8,5 m³"
            },
            {
                "label": "Prędkość maksymalna",
                "value": "120 km/h"
            },
            {
                "label": "Wyposażenie",
                "value": "V2L (zasilanie urządzeń z pojazdu), gniazda 230 V w kabinie i przestrzeni ładunkowej, Bluetooth 4.0, OTA, aluminiowa podłoga, drzwi przesuwne"
            },
            {
                "label": "Bezpieczeństwo",
                "value": "AEB, ostrzeganie o kolizji czołowej, monitorowanie martwego pola"
            }
        ],
        "faq": [
            {
                "q": "Jaki zasięg oferuje FOTON Cavan?",
                "a": "Cavan pokonuje do 333 km w cyklu WLTC, w zależności od wybranej baterii — 50,23 lub 66,67 kWh."
            },
            {
                "q": "Czym jest funkcja V2L w FOTON Cavan?",
                "a": "V2L (Vehicle-to-Load) pozwala zasilać urządzenia zewnętrzne bezpośrednio z pojazdu za pomocą gniazd 230 V, dostępnych zarówno w kabinie, jak i w przestrzeni ładunkowej."
            },
            {
                "q": "Jaka jest pojemność ładunkowa FOTON Cavan?",
                "a": "Przestrzeń ładunkowa wynosi od 6,8 do 8,5 m³, a aluminiowa podłoga i drzwi przesuwne ułatwiają codzienny załadunek w dystrybucji miejskiej."
            }
        ],
        "image": {
            "src": "https://fotonpolska.com.pl/wp-content/uploads/2026/05/foton-cavan-header.png",
            "alt": "FOTON Cavan — kompaktowy van elektryczny, widok reprezentacyjny"
        }
    },
    {
        "id": "emiler",
        "category": "fleet",
        "categoryLabel": "Pojazd Ciężarowy EV",
        "name": "FOTON eMiler",
        "tagline": "Elektryczna ciężarówka miejska o DMC 4,25 t",
        "heroParams": [
            "Elektryczny, DMC 4,25 t",
            "Zasięg do 180 km (WLTP)",
            "Ładowność do 2,3 t"
        ],
        "highlights": [
            "Napęd elektryczny z baterią CATL LFP (chłodzenie cieczą, ponad 2800 cykli)",
            "Zasięg do 180 km w cyklu WLTP",
            "Ładowność do 2,3 t, DMC 4,25 t",
            "Ładowanie: szybkie ok. 1,2 h, wolne ok. 7 h",
            "Sprawność napędu do 96%"
        ],
        "specs": [
            {
                "label": "Napęd",
                "value": "Elektryczny"
            },
            {
                "label": "Bateria",
                "value": "CATL LFP, ponad 2800 cykli, chłodzenie cieczą"
            },
            {
                "label": "Zasięg",
                "value": "do 180 km (WLTP)"
            },
            {
                "label": "Ładowanie",
                "value": "szybkie ok. 1,2 h / wolne ok. 7 h"
            },
            {
                "label": "Ładowność",
                "value": "do 2,3 t"
            },
            {
                "label": "DMC",
                "value": "4,25 t"
            },
            {
                "label": "Wymiary",
                "value": "5545 × 1870 × 2080 mm, rozstaw osi 2900 mm"
            },
            {
                "label": "Sprawność napędu",
                "value": "do 96%"
            },
            {
                "label": "Prędkość maksymalna",
                "value": "90 km/h"
            },
            {
                "label": "Gwarancja",
                "value": "akumulatory trakcyjne 5 lat / 200 000 km"
            }
        ],
        "faq": [
            {
                "q": "Jaki jest zasięg i czas ładowania FOTON eMiler?",
                "a": "eMiler pokonuje do 180 km w cyklu WLTP. Szybkie ładowanie uzupełnia baterię w ok. 1,2 godziny, a ładowanie wolne trwa ok. 7 godzin."
            },
            {
                "q": "Jaka jest dopuszczalna masa całkowita FOTON eMiler?",
                "a": "DMC eMilera wynosi 4,25 t, przy ładowności do 2,3 t. Pojazd napędza silnik elektryczny zasilany baterią CATL LFP chłodzoną cieczą."
            },
            {
                "q": "Jaka jest sprawność napędu FOTON eMiler?",
                "a": "Sprawność układu napędowego sięga do 96%, a prędkość maksymalna pojazdu wynosi 90 km/h. Gwarancja na akumulatory trakcyjne obejmuje 5 lat lub 200 000 km."
            }
        ],
        "image": {
            "src": "https://fotonpolska.com.pl/wp-content/uploads/2026/05/foton-emiler-header.png",
            "alt": "FOTON eMiler — elektryczna ciężarówka miejska, widok reprezentacyjny"
        }
    },
    {
        "id": "eaumark",
        "category": "fleet",
        "categoryLabel": "Pojazd Ciężarowy EV · N2",
        "name": "FOTON eAumark",
        "tagline": "Elektryczne podwozie pod zabudowę, trzy warianty napędu",
        "heroParams": [
            "3 warianty napędu: PHEV / BEV / H2",
            "Ładowność do 4,5 t",
            "DMC 7,5 t"
        ],
        "highlights": [
            "Trzy warianty napędu: Hybrid (PHEV), Electric (BEV) i Hydrogen",
            "Wariant BEV: zużycie 32 kWh/100 km, zasięg do 200 km (WLTP), sprawność e-axle ≥96,5%",
            "Wariant Hybrid (PHEV): silnik 2.5L/2.0L + bateria 14 kWh, zasięg ponad 1000 km",
            "Ładowność do 4,5 t, DMC 7,5 t",
            "Ładowanie: DC ok. 1 h / AC ok. 5 h"
        ],
        "specs": [
            {
                "label": "Wariant Hybrid (PHEV)",
                "value": "silnik 2.5L/2.0L + bateria 14 kWh, zasięg ponad 1000 km"
            },
            {
                "label": "Wariant Electric (BEV)",
                "value": "zużycie 32 kWh/100 km, sprawność e-axle ≥96,5%, zasięg do 200 km (WLTP)"
            },
            {
                "label": "Wariant Hydrogen",
                "value": "80 kW + bateria 30 kWh, zasięg do 450 km, tankowanie ok. 5 min — dostępność handlowa niepotwierdzona, prezentowana jako zdolność platformy"
            },
            {
                "label": "Ładowność",
                "value": "do 4,5 t"
            },
            {
                "label": "DMC",
                "value": "7,5 t"
            },
            {
                "label": "Wymiary",
                "value": "5400 × 2060 × 2300 mm (wersja wydłużona 5960 × 2060 × 2260 mm)"
            },
            {
                "label": "Rozstaw osi",
                "value": "2800 mm (wersja wydłużona 3360 mm)"
            },
            {
                "label": "Ładowanie",
                "value": "DC ok. 1 h / AC ok. 5 h"
            },
            {
                "label": "Kabina",
                "value": "fotel z amortyzacją pneumatyczną, klimatyzacja 360° (470 m³/h), hałas poniżej 65 dB, 23 schowki"
            },
            {
                "label": "Gwarancja",
                "value": "akumulatory 5 lat / 200 000 km"
            }
        ],
        "faq": [
            {
                "q": "Ile wariantów napędowych ma FOTON eAumark?",
                "a": "eAumark dostępny jest w trzech wariantach napędu: Hybrid (PHEV), Electric (BEV) oraz Hydrogen. Wariant wodorowy prezentowany jest jako zdolność platformy — jego dostępność handlowa nie jest obecnie potwierdzona."
            },
            {
                "q": "Jaki zasięg oferuje wariant elektryczny (BEV) eAumark?",
                "a": "Wariant Electric osiąga zasięg do 200 km w cyklu WLTP przy zużyciu 32 kWh/100 km, a elektryczna oś napędowa (e-axle) pracuje ze sprawnością sięgającą 96,5%."
            },
            {
                "q": "Jaka jest ładowność i DMC FOTON eAumark?",
                "a": "Ładowność sięga do 4,5 t przy dopuszczalnej masie całkowitej 7,5 t. Dostępna jest wersja standardowa oraz wydłużona podwozia."
            }
        ],
        "image": {
            "src": "https://fotonpolska.com.pl/wp-content/uploads/2026/05/foton-eaumark.png",
            "alt": "FOTON eAumark — elektryczne podwozie ciężarowe, widok reprezentacyjny"
        }
    },
    {
        "id": "aumark-s",
        "category": "fleet",
        "categoryLabel": "Ciężarowy Diesel · N2/N3",
        "name": "FOTON Aumark S",
        "tagline": "Ciężarówka dystrybucyjna z silnikiem Cummins",
        "heroParams": [
            "Diesel Cummins, 156 KM / 550 Nm",
            "Norma emisji Euro VI",
            "Rozstaw osi 3800 mm"
        ],
        "highlights": [
            "Silnik wysokoprężny Cummins F3.8EVIE156, 3,76 l, 156 KM / 550 Nm, norma Euro VI",
            "Dostępne warianty silnika: ISF2.8 (96–110 kW) oraz ISF3.8 (105–125 kW)",
            "Hamulce pneumatyczne, tarczowe na obu osiach, wspomaganie elektroniczne",
            "Bezpieczeństwo: AEBS, LDWS, FCW, ESC, EBS, BSIS, MoIS, DDAWS, ISA, kamera cofania"
        ],
        "specs": [
            {
                "label": "Silnik (główny)",
                "value": "Cummins F3.8EVIE156, 3,76 l, 156 KM / 550 Nm, Euro VI"
            },
            {
                "label": "Warianty silnika",
                "value": "ISF2.8: 2,776 l, 96–110 kW, 320–360 Nm · ISF3.8: 3,76 l, 105–125 kW, 450–600 Nm"
            },
            {
                "label": "Rozstaw osi",
                "value": "3800 mm"
            },
            {
                "label": "Hamulce",
                "value": "pneumatyczne, tarczowe na obu osiach, wspomaganie elektroniczne"
            },
            {
                "label": "Bezpieczeństwo",
                "value": "AEBS, LDWS, FCW, ESC, EBS, BSIS, MoIS, DDAWS, ISA, kamera cofania"
            },
            {
                "label": "Wyposażenie",
                "value": "klimatyzacja, MP5, Bluetooth, elektryczne szyby, centralny zamek, tempomat ACC"
            }
        ],
        "faq": [
            {
                "q": "Jaki silnik napędza FOTON Aumark S?",
                "a": "Aumark S napędza silnik wysokoprężny Cummins F3.8EVIE156 o pojemności 3,76 l, mocy 156 KM i momencie obrotowym 550 Nm, spełniający normę emisji Euro VI."
            },
            {
                "q": "Jakie systemy bezpieczeństwa ma FOTON Aumark S?",
                "a": "Pojazd wyposażono w AEBS, LDWS, FCW, ESC, EBS, BSIS, MoIS, DDAWS, ISA oraz kamerę cofania. Hamulce pneumatyczne działają na obu osiach ze wspomaganiem elektronicznym."
            },
            {
                "q": "Czy dostępne są inne warianty silnika FOTON Aumark S?",
                "a": "Poza silnikiem głównym Cummins F3.8EVIE156 importer wymienia warianty ISF2.8 (2,776 l, 96–110 kW, 320–360 Nm) oraz ISF3.8 (3,76 l, 105–125 kW, 450–600 Nm)."
            }
        ],
        "image": {
            "src": "https://fotonpolska.com.pl/wp-content/uploads/2026/05/AUMARK.webp",
            "alt": "FOTON Aumark S — ciężarówka dystrybucyjna z silnikiem wysokoprężnym, widok reprezentacyjny"
        }
    }
];

export const FOTON_SEO_HUB_FAQ: FotonSeoFaq[] = [
    {
        "q": "Czy Motolia jest dealerem lub importerem marki FOTON?",
        "a": "Nie. Motolia Sp. z o.o. działa jako Agent Importera marki FOTON – firmy Power Truck Poland Sp. z o.o. Umowa sprzedaży pojazdu zawierana jest bezpośrednio z Power Truck Poland Sp. z o.o. Rola Motolii polega na profesjonalnym doborze pojazdu, przeprowadzeniu konfiguracji oraz wynegocjowaniu optymalnego finansowania w bankach i firmach leasingowych."
    },
    {
        "q": "Dlaczego warto zamówić pojazd FOTON przez brokera finansowego Motolia?",
        "a": "FOTON to nowa marka na polskim rynku, przez co tradycyjne instytucje finansowe bywają ostrożne przy wycenie wartości rezydualnej. Motolia współpracuje z Inbank, PKO, Erste, Vehis, Masterlease, BNP Paribas i wieloma instytucjami w Polsce, dzięki czemu dobieramy finansowanie tam, gdzie warunki są najkorzystniejsze."
    },
    {
        "q": "Jak przebiega serwis oraz realizacja gwarancji na pojazdy FOTON?",
        "a": "Gwarancji na pojazdy udziela importer Power Truck Poland Sp. z o.o. Obowiązuje gwarancja fabryczna 5 lat lub 200 000 km na cały pojazd oraz 8 lat lub 400 000 km na baterie trakcyjne w modelach elektrycznych. Obsługę serwisową i przeglądy wykonuje sieć autoryzowanych partnerów serwisowych Power Truck Poland w Polsce."
    },
    {
        "q": "Jakie są zalety podatkowe zakupu pickupa Tunland G7 na firmę?",
        "a": "Pickup z otwartą lub zamykaną roletą skrzynią ładunkową pozwala na korzystne zaliczanie wydatków eksploatacyjnych w koszty uzyskania przychodu. Doradcy Motolii pomogą ustrukturyzować umowę leasingu operacyjnego tak, aby optymalnie wykorzystać korzyści podatkowe w Twojej działalności."
    },
    {
        "q": "Jakie formy finansowania oferuje Motolia na pojazdy FOTON?",
        "a": "Dla klientów B2B oraz flot oferujemy elastyczny leasing operacyjny, najem długoterminowy z pełną obsługą (FSL), kredyt firmowy oraz pożyczkę leasingową. Płatność raty ubezpieczeniowej można dogodnie połączyć w jedną ratę miesięczną."
    }
];

export function getFotonSeoModel(id: string): FotonSeoModel | undefined {
    return FOTON_SEO_MODELS.find(m => m.id === id);
}
