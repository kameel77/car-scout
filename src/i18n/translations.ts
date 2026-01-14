export const translations = {
  pl: {
    translation: {
      // Common
      common: {
        search: "Szukaj",
        clear: "Wyczyść",
        clearFilters: "Wyczyść filtry",
        apply: "Zastosuj",
        cancel: "Anuluj",
        save: "Zapisz",
        loading: "Ładowanie...",
        noData: "Brak danych",
        showMore: "Pokaż więcej",
        showLess: "Pokaż mniej",
        back: "Wróć",
        next: "Dalej",
        previous: "Poprzedni",
        send: "Wyślij",
        required: "Wymagane",
        optional: "Opcjonalne",
        from: "Od",
        to: "Do",
        all: "Wszystkie",
        results: "wyników",
        found: "Znaleziono",
        offers: "ofert",
        perPage: "na stronę",
        toTop: "Do góry",
      },

      // Navigation
      nav: {
        home: "Strona główna",
        search: "Wyszukiwarka",
        favorites: "Ulubione",
        contact: "Kontakt",
      },

      // Header
      header: {
        searchPlaceholder: "Szukaj marki, modelu...",
        language: "Język",
        saveSearch: "Zapisz wyszukiwanie",
      },

      // Search
      search: {
        placeholder: "Szukaj marki, modelu, typu nadwozia...",
      },

      // Filters
      filters: {
        title: "Filtry",
        make: "Marka",
        model: "Model",
        version: "Wersja",
        fuelType: "Rodzaj paliwa",
        productionYear: "Rok produkcji",
        mileage: "Przebieg",
        drive: "Napęd",
        transmission: "Skrzynia biegów",
        power: "Moc",
        engineCapacity: "Pojemność skokowa",
        bodyType: "Typ nadwozia",
        price: "Cena",
        selectMake: "Wybierz markę",
        selectModel: "Wybierz model",
        anyVersion: "Dowolna wersja",
        yearFrom: "Rok od",
        yearTo: "Rok do",
        mileageFrom: "Przebieg od",
        mileageTo: "Przebieg do",
        powerFrom: "Moc od",
        powerTo: "Moc do",
        capacityFrom: "Pojemność od",
        capacityTo: "Pojemność do",
        priceFrom: "Cena od",
        priceTo: "Cena do",
      },

      // Fuel types
      fuel: {
        petrol: "Benzyna",
        diesel: "Diesel",
        hybrid: "Hybryda",
        hybridHev: "Hybryda HEV",
        hybridPhev: "Hybryda PHEV",
        electric: "Elektryczny",
        lpg: "LPG",
        cng: "CNG",
      },

      // Transmission
      transmission: {
        manual: "Manualna",
        automatic: "Automatyczna",
      },

      // Drive
      drive: {
        fwd: "Przedni (FWD)",
        rwd: "Tylny (RWD)",
        awd: "4x4 / AWD",
      },

      // Body types
      body: {
        sedan: "Sedan",
        hatchback: "Hatchback",
        suv: "SUV",
        kombi: "Kombi",
        coupe: "Coupe",
        cabrio: "Kabriolet",
        van: "Van",
        pickup: "Pickup",
        minivan: "Minivan",
      },

      // Sorting
      sort: {
        title: "Sortuj",
        cheapest: "Najtańsze",
        mostExpensive: "Najdroższe",
        lowestMileage: "Najmniejszy przebieg",
        newest: "Najmłodszy rocznik",
      },

      // Listing card
      listing: {
        viewOffer: "Zobacz ofertę",
        km: "km",
        hp: "KM",
        ccm: "cm³",
        year: "rok",
        dealer: "Dealer",
        location: "Lokalizacja",
        mileage: "Przebieg",
        net: "ceny netto",
        gross: "ceny brutto",
        specialOffer: "Oferta dla Ciebie",
      },

      // Listing detail
      detail: {
        askAbout: "Zapytaj o ofertę",
        call: "Zadzwoń",
        sendInquiry: "Wyślij zapytanie",
        keyParameters: "Kluczowe parametry",
        specifications: "Specyfikacja techniczna",
        equipment: "Wyposażenie",
        dealerInfo: "Informacje o dealerze",
        gallery: "Galeria",
        photos: "zdjęć",
        vin: "VIN",
        firstRegistration: "Data pierwszej rejestracji",
        registrationNumber: "Numer rejestracyjny",
        lowestPrice: "Najniższa cena z 30 dni",
        archivedTitle: "Ogłoszenie jest już nieaktualne",
        archivedDescription: "Zostało ono automatycznie zarchiwizowane, ponieważ nie jest już dostępne u źródła lub wystąpił błąd danych.",
        returnToSearch: "Wróć na stronę wyszukiwania",
      },

      // Equipment sections
      equipment: {
        audioMultimedia: "Audio i multimedia",
        safety: "Bezpieczeństwo",
        comfort: "Komfort i dodatki",
        performance: "Osiągi i tuning",
        driverAssist: "Systemy wspomagania kierowcy",
        other: "Inne",
        noItems: "Brak elementów w tej kategorii",
      },

      // Lead form
      lead: {
        title: "Zapytaj o ofertę",
        subtitle: "Wypełnij formularz, a dealer skontaktuje się z Tobą",
        offerSummary: "Podsumowanie oferty",
        name: "Imię i nazwisko",
        namePlaceholder: "Jan Kowalski",
        email: "Adres e-mail",
        emailPlaceholder: "jan@example.com",
        phone: "Numer telefonu",
        phonePlaceholder: "+48 123 456 789",
        preferredContact: "Preferowany kontakt",
        contactEmail: "E-mail",
        contactPhone: "Telefon",
        message: "Wiadomość",
        messagePlaceholder: "O co chcesz zapytać?",
        messageDefault: "Dzień dobry, proszę o kontakt w sprawie oferty {{make}} {{model}} {{version}} ({{listingId}}).",
        consentMarketing: "Wyrażam zgodę na otrzymywanie informacji handlowych drogą elektroniczną (marketing bezpośredni) dotyczących ofert finansowania i ubezpieczeń. *",
        consentPrivacy: "Oświadczam, że zapoznałem się z Regulaminem oraz Polityką Prywatności i akceptuję ich postanowienia. Wyrażam zgodę na przetwarzanie moich danych osobowych w celu obsługi zapytania. *",
        submit: "Wyślij zapytanie",
        sending: "Wysyłanie...",
        successTitle: "Zgłoszenie wysłane!",
        successMessage: "Dziękujemy za zainteresowanie. Nasz doradca skontaktuje się z Tobą wkrótce.",
        referenceNumber: "Numer zgłoszenia",
        backToResults: "Wróć do wyszukiwarki",
        backToOffer: "Wróć do ogłoszenia",
        error: "Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później.",
        retry: "Spróbuj ponownie",
        requiredFields: "* Pola oznaczone gwiazdką są wymagane",
        fastQuestions: "Szybkie pytania",
        trust: {
          fastResponse: "Szybka odpowiedź",
          averageTime: "Średni czas odpowiedzi: ~45 minut",
          secureTitle: "Bezpieczny kontakt",
          secureDesc: "Twoje dane są chronione i użyte tylko do tego zapytania.",
        },
        quickInquiry: {
          availability: "Czy auto jest dostępne?",
          financing: "Oferta finansowania",
          history: "Raport historii i VIN",
          expert: "Kontakt z ekspertem",
          message: {
            availability: "Dzień dobry, czy oferta na ten model jest aktualna i czy auto jest dostępne od ręki?",
            financing: "Interesuje mnie oferta leasingu lub najmu długoterminowego dla tego auta. Proszę o przygotowanie symulacji.",
            history: "Poproszę o przesłanie numeru VIN oraz raportu historii pojazdu dla tego modelu.",
            expert: "Chciałbym skonsultować specyfikację i warunki zakupu tego pojazdu z Państwa doradcą.",
          }
        }
      },

      // Validation
      validation: {
        required: "To pole jest wymagane",
        invalidEmail: "Nieprawidłowy adres e-mail",
        invalidPhone: "Nieprawidłowy numer telefonu (np. +48 123 456 789)",
        minLength: "Minimum {{min}} znaków",
        maxLength: "Maksimum {{max}} znaków",
      },

      // Empty states
      empty: {
        noResults: "Nie znaleziono ofert",
        noResultsHint: "Spróbuj zmienić kryteria wyszukiwania",
        noPhotos: "Brak zdjęć",
      },

      // SEO
      seo: {
        listingTitle: "{{make}} {{model}} {{version}} {{year}} - {{price}} | AutoFinder",
        listingDescription: "{{make}} {{model}} {{version}}, {{year}}, {{mileage}} km, {{fuel}}, {{power}} KM. Sprawdź szczegóły oferty.",
      },
      // Specs
      specs: {
        color: "Kolor",
        bodyType: "Typ nadwozia",
        doors: "Liczba drzwi",
        seats: "Liczba miejsc",
        paintType: "Rodzaj lakieru",
        vin: "VIN",
        firstRegistration: "Data pierwszej rejestracji",
        registrationNumber: "Numer rejestracyjny",
        condition: "Stan",
        origin: "Kraj pochodzenia",
      },
      // Equipment Features (normalized keys)
      features: {
        klimatyzacja_automatyczna: "Klimatyzacja automatyczna",
        klimatyzacja_manualna: "Klimatyzacja manualna",
        skorzana_tapicerka: "Skórzana tapicerka",
        nawigacja_gps: "Nawigacja GPS",
        czujniki_parkowania_przod: "Czujniki parkowania przód",
        czujniki_parkowania_tyl: "Czujniki parkowania tył",
        kamera_cofania: "Kamera cofania",
        tempomat: "Tempomat",
        tempomat_adaptacyjny: "Tempomat adaptacyjny",
        podgrzewane_fotele_przednie: "Podgrzewane fotele przednie",
        podgrzewana_kierownica: "Podgrzewana kierownica",
        system_naglosnienia: "System nagłośnienia",
        apple_carplay: "Apple CarPlay",
        android_auto: "Android Auto",
        bluetooth: "Bluetooth",
        felgi_aluminiowe: "Felgi aluminiowe",
        swiatla_led: "Światła LED",
        matrycowe_led: "Matrycowe LED",
        system_start_stop: "System Start-Stop",
        bezkluczykowy_dostep: "Bezkluczykowy dostęp",
      },
      footer: {
        legal: "Informacje prawne",
        documents: "Dokumenty",
        imprint: "Imprint / Impressum",
        privacy: "Polityka prywatności",
        terms: "Regulamin / AGB",
        cookies: "Polityka cookies",
        contact: "Kontakt",
        company: "Dane podmiotu",
        vat: "NIP / VAT ID",
        register: "Rejestr (KRS/Handelsregister)",
        representative: "Osoba uprawniona do reprezentacji",
        missing: "Brak podpiętego dokumentu dla tego języka.",
      },
    },
  },

  en: {
    translation: {
      // Common
      common: {
        search: "Search",
        clear: "Clear",
        clearFilters: "Clear filters",
        apply: "Apply",
        cancel: "Cancel",
        save: "Save",
        loading: "Loading...",
        noData: "No data",
        showMore: "Show more",
        showLess: "Show less",
        back: "Back",
        next: "Next",
        previous: "Previous",
        send: "Send",
        required: "Required",
        optional: "Optional",
        from: "From",
        to: "To",
        all: "All",
        results: "results",
        found: "Found",
        offers: "offers",
        perPage: "per page",
        toTop: "Back to top",
      },

      // Navigation
      nav: {
        home: "Home",
        search: "Search",
        favorites: "Favorites",
        contact: "Contact",
      },

      // Header
      header: {
        searchPlaceholder: "Search make, model...",
        language: "Language",
        saveSearch: "Save search",
      },

      // Search
      search: {
        placeholder: "Search by make, model, body type...",
      },

      // Filters
      filters: {
        title: "Filters",
        make: "Make",
        model: "Model",
        version: "Trim / Version",
        fuelType: "Fuel type",
        productionYear: "Year",
        mileage: "Mileage",
        drive: "Drivetrain",
        transmission: "Transmission",
        power: "Power",
        engineCapacity: "Engine capacity",
        bodyType: "Body type",
        price: "Price",
        selectMake: "Select make",
        selectModel: "Select model",
        anyVersion: "Any version",
        yearFrom: "Year from",
        yearTo: "Year to",
        mileageFrom: "Mileage from",
        mileageTo: "Mileage to",
        powerFrom: "Power from",
        powerTo: "Power to",
        capacityFrom: "Capacity from",
        capacityTo: "Capacity to",
        priceFrom: "Price from",
        priceTo: "Price to",
      },

      // Fuel types
      fuel: {
        petrol: "Petrol",
        diesel: "Diesel",
        hybrid: "Hybrid",
        hybridHev: "Hybrid HEV",
        hybridPhev: "Plug-in Hybrid",
        electric: "Electric",
        lpg: "LPG",
        cng: "CNG",
      },

      // Transmission
      transmission: {
        manual: "Manual",
        automatic: "Automatic",
      },

      // Drive
      drive: {
        fwd: "Front-wheel (FWD)",
        rwd: "Rear-wheel (RWD)",
        awd: "All-wheel / AWD",
      },

      // Body types
      body: {
        sedan: "Sedan",
        hatchback: "Hatchback",
        suv: "SUV",
        kombi: "Estate",
        coupe: "Coupe",
        cabrio: "Convertible",
        van: "Van",
        pickup: "Pickup",
        minivan: "Minivan",
      },

      // Sorting
      sort: {
        title: "Sort",
        cheapest: "Cheapest",
        mostExpensive: "Most expensive",
        lowestMileage: "Lowest mileage",
        newest: "Newest",
      },

      // Listing card
      listing: {
        viewOffer: "View offer",
        km: "km",
        hp: "HP",
        ccm: "cc",
        year: "year",
        dealer: "Dealer",
        location: "Location",
        mileage: "Mileage",
        net: "net prices",
        gross: "gross prices",
        specialOffer: "Your special offer",
      },

      // Listing detail
      detail: {
        askAbout: "Ask about this offer",
        call: "Call",
        sendInquiry: "Send inquiry",
        keyParameters: "Key parameters",
        specifications: "Technical specifications",
        equipment: "Equipment",
        dealerInfo: "Dealer information",
        gallery: "Gallery",
        photos: "photos",
        vin: "VIN",
        firstRegistration: "First registration",
        registrationNumber: "Registration number",
        lowestPrice: "Lowest price in 30 days",
        archivedTitle: "This listing is no longer current",
        archivedDescription: "It has been automatically archived because it is no longer available from the source or there was a data error.",
        returnToSearch: "Return to search page",
      },

      // Equipment sections
      equipment: {
        audioMultimedia: "Audio & Multimedia",
        safety: "Safety",
        comfort: "Comfort & Extras",
        performance: "Performance & Tuning",
        driverAssist: "Driver assistance",
        other: "Other",
        noItems: "No items in this category",
      },

      // Lead form
      lead: {
        title: "Ask about this offer",
        subtitle: "Fill in the form and the dealer will contact you",
        offerSummary: "Offer summary",
        name: "Full name",
        namePlaceholder: "John Smith",
        email: "Email address",
        emailPlaceholder: "john@example.com",
        phone: "Phone number",
        phonePlaceholder: "+1 234 567 890",
        preferredContact: "Preferred contact",
        contactEmail: "Email",
        contactPhone: "Phone",
        message: "Message",
        messagePlaceholder: "Hello, I would like to inquire about this offer",
        messageDefault: "Hello, I would like to inquire about {{make}} {{model}} {{version}} ({{listingId}}).",
        consentMarketing: "I consent to marketing contact",
        consentPrivacy: "I accept the privacy policy",
        submit: "Send inquiry",
        sending: "Sending...",
        successTitle: "Thank you!",
        successMessage: "Your inquiry has been sent. The dealer will contact you soon.",
        referenceNumber: "Reference number",
        backToResults: "Back to results",
        backToOffer: "Back to offer",
        error: "An error occurred while sending your inquiry. Please try again later.",
        retry: "Try again",
        requiredFields: "* Fields marked with an asterisk are required",
        fastQuestions: "Quick questions",
        trust: {
          fastResponse: "Fast response",
          averageTime: "Average response time: ~45 minutes",
          secureTitle: "Secure contact",
          secureDesc: "Your data is protected and used only for this inquiry.",
        },
        quickInquiry: {
          availability: "Is this car available?",
          financing: "Financing offer",
          history: "History report & VIN",
          expert: "Expert contact",
          message: {
            availability: "Hello, is this car still available for immediate delivery?",
            financing: "I am interested in leasing or long-term rental options for this car. Please prepare a quote.",
            history: "Could you please send me the VIN and history report for this car?",
            expert: "I would like to discuss the specification and purchase conditions for this car with your advisor.",
          }
        }
      },

      // Validation
      validation: {
        required: "This field is required",
        invalidEmail: "Invalid email address",
        invalidPhone: "Invalid phone number (e.g. +48 123 456 789)",
        minLength: "Minimum {{min}} characters",
        maxLength: "Maximum {{max}} characters",
      },

      // Empty states
      empty: {
        noResults: "No offers found",
        noResultsHint: "Try adjusting your search criteria",
        noPhotos: "No photos",
      },

      // SEO
      seo: {
        listingTitle: "{{make}} {{model}} {{version}} {{year}} - {{price}} | AutoFinder",
        listingDescription: "{{make}} {{model}} {{version}}, {{year}}, {{mileage}} km, {{fuel}}, {{power}} hp. Check offer details.",
      },
      // Specs
      specs: {
        color: "Color",
        bodyType: "Body type",
        doors: "Doors",
        seats: "Seats",
        paintType: "Paint type",
        vin: "VIN",
        firstRegistration: "First registration",
        registrationNumber: "Registration number",
        condition: "Condition",
        origin: "Country of origin",
      },
      // Equipment Features (normalized keys)
      features: {
        klimatyzacja_automatyczna: "Automatic climate control",
        klimatyzacja_manualna: "Manual climate control",
        skorzana_tapicerka: "Leather upholstery",
        nawigacja_gps: "GPS Navigation",
        czujniki_parkowania_przod: "Front parking sensors",
        czujniki_parkowania_tyl: "Rear parking sensors",
        kamera_cofania: "Rear view camera",
        tempomat: "Cruise control",
        tempomat_adaptacyjny: "Adaptive cruise control",
        podgrzewane_fotele_przednie: "Heated front seats",
        podgrzewana_kierownica: "Heated steering wheel",
        system_naglosnienia: "Sound system",
        apple_carplay: "Apple CarPlay",
        android_auto: "Android Auto",
        bluetooth: "Bluetooth",
        felgi_aluminiowe: "Alloy wheels",
        swiatla_led: "LED headlights",
        matrycowe_led: "Matrix LED",
        system_start_stop: "Start-Stop system",
        bezkluczykowy_dostep: "Keyless access",
      },
      footer: {
        legal: "Legal",
        documents: "Documents",
        imprint: "Imprint",
        privacy: "Privacy Policy",
        terms: "Terms & Conditions",
        cookies: "Cookie Policy",
        contact: "Contact",
        company: "Company info",
        vat: "VAT / Tax ID",
        register: "Registry number",
        representative: "Authorized representative",
        missing: "No document linked for this language.",
      },
    },
  },

  de: {
    translation: {
      // Common
      common: {
        search: "Suchen",
        clear: "Löschen",
        clearFilters: "Filter löschen",
        apply: "Anwenden",
        cancel: "Abbrechen",
        save: "Speichern",
        loading: "Laden...",
        noData: "Keine Daten",
        showMore: "Mehr anzeigen",
        showLess: "Weniger anzeigen",
        back: "Zurück",
        next: "Weiter",
        previous: "Zurück",
        send: "Senden",
        required: "Erforderlich",
        optional: "Optional",
        from: "Von",
        to: "Bis",
        all: "Alle",
        results: "Ergebnisse",
        found: "Gefunden",
        offers: "Angebote",
      },

      // Navigation
      nav: {
        home: "Startseite",
        search: "Suche",
        favorites: "Favoriten",
        contact: "Kontakt",
      },

      // Header
      header: {
        searchPlaceholder: "Marke, Modell suchen...",
        language: "Sprache",
        saveSearch: "Suche speichern",
      },

      // Search
      search: {
        placeholder: "Suchen nach Marke, Modell, Erstzulassung, Fahrzeugtypen...",
      },

      // Filters
      filters: {
        title: "Filter",
        make: "Marke",
        model: "Modell",
        version: "Variante / Ausstattung",
        fuelType: "Kraftstoff",
        productionYear: "Baujahr",
        mileage: "Kilometerstand",
        drive: "Antrieb",
        transmission: "Getriebe",
        power: "Leistung",
        engineCapacity: "Hubraum",
        bodyType: "Karosserie",
        price: "Preis",
        selectMake: "Marke wählen",
        selectModel: "Modell wählen",
        anyVersion: "Beliebige Variante",
        yearFrom: "Jahr von",
        yearTo: "Jahr bis",
        mileageFrom: "Km von",
        mileageTo: "Km bis",
        powerFrom: "Leistung von",
        powerTo: "Leistung bis",
        capacityFrom: "Hubraum von",
        capacityTo: "Hubraum bis",
        priceFrom: "Preis von",
        priceTo: "Preis bis",
      },

      // Fuel types
      fuel: {
        petrol: "Benzin",
        diesel: "Diesel",
        hybrid: "Hybrid",
        hybridHev: "Hybrid HEV",
        hybridPhev: "Plug-in Hybrid",
        electric: "Elektro",
        lpg: "LPG",
        cng: "CNG",
      },

      // Transmission
      transmission: {
        manual: "Schaltgetriebe",
        automatic: "Automatik",
      },

      // Drive
      drive: {
        fwd: "Frontantrieb (FWD)",
        rwd: "Heckantrieb (RWD)",
        awd: "Allrad / AWD",
      },

      // Body types
      body: {
        sedan: "Limousine",
        hatchback: "Schrägheck",
        suv: "SUV",
        kombi: "Kombi",
        coupe: "Coupé",
        cabrio: "Cabrio",
        van: "Van",
        pickup: "Pickup",
        minivan: "Minivan",
      },

      // Sorting
      sort: {
        title: "Sortieren",
        cheapest: "Günstigste",
        mostExpensive: "Teuerste",
        lowestMileage: "Niedrigster Km-Stand",
        newest: "Neueste",
      },

      // Listing card
      listing: {
        viewOffer: "Angebot ansehen",
        km: "km",
        hp: "PS",
        ccm: "cm³",
        year: "Jahr",
        dealer: "Händler",
        location: "Standort",
        mileage: "Kilometerstand",
        net: "Nettopreise",
        gross: "Bruttopreise",
        specialOffer: "Angebot für dich",
      },

      // Listing detail
      detail: {
        askAbout: "Anfrage senden",
        call: "Anrufen",
        sendInquiry: "Anfrage senden",
        keyParameters: "Wichtige Parameter",
        specifications: "Technische Daten",
        equipment: "Ausstattung",
        dealerInfo: "Händlerinformationen",
        gallery: "Galerie",
        photos: "Fotos",
        vin: "VIN",
        firstRegistration: "Erstzulassung",
        registrationNumber: "Kennzeichen",
        lowestPrice: "Niedrigster Preis in 30 Tagen",
        archivedTitle: "Diese Anzeige ist nicht mehr aktuell",
        archivedDescription: "Sie wurde automatisch archiviert, da sie nicht mehr von der Quelle verfügbar ist oder ein Datenfehler aufgetreten ist.",
        returnToSearch: "Zurück zur Suchseite",
      },

      // Equipment sections
      equipment: {
        audioMultimedia: "Audio & Multimedia",
        safety: "Sicherheit",
        comfort: "Komfort & Extras",
        performance: "Leistung & Tuning",
        driverAssist: "Fahrerassistenz",
        other: "Sonstiges",
        noItems: "Keine Elemente in dieser Kategorie",
      },

      // Lead form
      lead: {
        title: "Anfrage zum Angebot",
        subtitle: "Füllen Sie das Formular aus und der Händler wird Sie kontaktieren",
        offerSummary: "Angebotsübersicht",
        name: "Vollständiger Name",
        namePlaceholder: "Max Mustermann",
        email: "E-Mail-Adresse",
        emailPlaceholder: "max@example.com",
        phone: "Telefonnummer",
        phonePlaceholder: "+49 123 456 789",
        preferredContact: "Bevorzugter Kontakt",
        contactEmail: "E-Mail",
        contactPhone: "Telefon",
        message: "Nachricht",
        messagePlaceholder: "Guten Tag, ich interessiere mich für dieses Angebot",
        messageDefault: "Guten Tag, ich interessiere mich für {{make}} {{model}} {{version}} ({{listingId}}).",
        consentMarketing: "Ich stimme der Marketingkontaktaufnahme zu",
        consentPrivacy: "Ich akzeptiere die Datenschutzrichtlinie",
        submit: "Anfrage senden",
        sending: "Wird gesendet...",
        successTitle: "Vielen Dank!",
        successMessage: "Ihre Anfrage wurde gesendet. Der Händler wird Sie in Kürze kontaktieren.",
        referenceNumber: "Referenznummer",
        backToResults: "Zurück zu den Ergebnissen",
        backToOffer: "Zurück zum Angebot",
        error: "Beim Senden Ihrer Anfrage ist ein Fehler aufgetreten. Bitte versuchen Sie es später noch einmal.",
        retry: "Erneut versuchen",
        requiredFields: "* Mit einem Sternchen gekennzeichnete Felder są obowiązkowe",
        fastQuestions: "Schnelle Fragen",
        trust: {
          fastResponse: "Schnelle Antwort",
          averageTime: "Durchschnittliche Antwortzeit: ~45 Minuten",
          secureTitle: "Sicherer Kontakt",
          secureDesc: "Ihre Daten sind geschützt und werden nur für diese Anfrage verwendet.",
        },
        quickInquiry: {
          availability: "Ist das Auto verfügbar?",
          financing: "Finanzierungsangebot",
          history: "Historienbericht & VIN",
          expert: "Expertenkontakt",
          message: {
            availability: "Guten Tag, ist dieses Modell noch sofort verfügbar?",
            financing: "Ich interessiere mich für Leasing- oder Langzeitmietoptionen für dieses Auto. Bitte erstellen Sie ein Angebot.",
            history: "Könnten Sie mir bitte die Fahrgestellnummer (VIN) und den Historienbericht für dieses Auto zusenden?",
            expert: "Ich möchte die Spezifikation und Kaufbedingungen für dieses Fahrzeug mit Ihrem Berater besprechen.",
          }
        }
      },

      // Validation
      validation: {
        required: "Dieses Feld ist erforderlich",
        invalidEmail: "Ungültige E-Mail-Adresse",
        invalidPhone: "Ungültige Telefonnummer (z. B. +48 123 456 789)",
        minLength: "Mindestens {{min}} Zeichen",
        maxLength: "Maximal {{max}} Zeichen",
      },

      // Empty states
      empty: {
        noResults: "Keine Angebote gefunden",
        noResultsHint: "Versuchen Sie, Ihre Suchkriterien anzupassen",
        noPhotos: "Keine Fotos",
      },

      // SEO
      seo: {
        listingTitle: "{{make}} {{model}} {{version}} {{year}} - {{price}} | AutoFinder",
        listingDescription: "{{make}} {{model}} {{version}}, {{year}}, {{mileage}} km, {{fuel}}, {{power}} PS. Angebotsdetails prüfen.",
      },
      // Specs
      specs: {
        color: "Farbe",
        bodyType: "Karosserieform",
        doors: "Türen",
        seats: "Sitzplätze",
        paintType: "Lackierung",
        vin: "VIN",
        firstRegistration: "Erstzulassung",
        registrationNumber: "Kennzeichen",
        condition: "Zustand",
        origin: "Herkunft",
      },
      // Equipment Features (normalized keys)
      features: {
        klimatyzacja_automatyczna: "Klimaautomatik",
        klimatyzacja_manualna: "Manuelle Klimaanlage",
        skorzana_tapicerka: "Lederausstattung",
        nawigacja_gps: "Navigationssystem",
        czujniki_parkowania_przod: "Einparkhilfe vorne",
        czujniki_parkowania_tyl: "Einparkhilfe hinten",
        kamera_cofania: "Rückfahrkamera",
        tempomat: "Tempomat",
        tempomat_adaptacyjny: "Abstandsregeltempomat",
        podgrzewane_fotele_przednie: "Sitzheizung vorne",
        podgrzewana_kierownica: "Beheizbares Lenkrad",
        system_naglosnienia: "Soundsystem",
        apple_carplay: "Apple CarPlay",
        android_auto: "Android Auto",
        bluetooth: "Bluetooth",
        felgi_aluminiowe: "Leichtmetallfelgen",
        swiatla_led: "LED-Scheinwerfer",
        matrycowe_led: "Matrix-LED",
        system_start_stop: "Start-Stopp-System",
        bezkluczykowy_dostep: "Keyless Entry",
      },
      footer: {
        legal: "Rechtliches",
        documents: "Dokumente",
        imprint: "Impressum",
        privacy: "Datenschutzerklärung",
        terms: "AGB / Nutzungsbedingungen",
        cookies: "Cookie-Richtlinie",
        contact: "Kontakt",
        company: "Unternehmensdaten",
        vat: "USt-IdNr.",
        register: "Handelsregister",
        representative: "Vertretungsberechtigte Person",
        missing: "Kein Dokument für diese Sprache hinterlegt.",
      },
    },
  },
};
