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
        engineCapacity: "Pojemność silnika",
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
        messagePlaceholder: "Dzień dobry, proszę o kontakt w sprawie oferty",
        messageDefault: "Dzień dobry, proszę o kontakt w sprawie oferty {{make}} {{model}} {{version}} ({{listingId}}).",
        consentMarketing: "Wyrażam zgodę na kontakt handlowy",
        consentPrivacy: "Akceptuję politykę prywatności",
        submit: "Wyślij zapytanie",
        sending: "Wysyłanie...",
        successTitle: "Dziękujemy!",
        successMessage: "Twoje zapytanie zostało wysłane. Dealer skontaktuje się z Tobą wkrótce.",
        referenceNumber: "Numer zgłoszenia",
        backToResults: "Wróć do wyników",
        backToOffer: "Wróć do oferty",
        error: "Wystąpił błąd. Spróbuj ponownie.",
        retry: "Spróbuj ponownie",
      },
      
      // Validation
      validation: {
        required: "To pole jest wymagane",
        invalidEmail: "Nieprawidłowy adres e-mail",
        invalidPhone: "Nieprawidłowy numer telefonu",
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
        searchTitle: "Wyszukiwarka samochodów | AutoFinder",
        searchDescription: "Znajdź idealne auto wśród tysięcy ofert. Filtry, porównania i szczegółowe specyfikacje.",
        listingTitle: "{{make}} {{model}} {{version}} {{year}} - {{price}} | AutoFinder",
        listingDescription: "{{make}} {{model}} {{version}}, {{year}}, {{mileage}} km, {{fuel}}, {{power}} KM. Sprawdź szczegóły oferty.",
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
        hp: "hp",
        ccm: "cc",
        year: "year",
        dealer: "Dealer",
        location: "Location",
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
        error: "An error occurred. Please try again.",
        retry: "Try again",
      },
      
      // Validation
      validation: {
        required: "This field is required",
        invalidEmail: "Invalid email address",
        invalidPhone: "Invalid phone number",
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
        searchTitle: "Car Search | AutoFinder",
        searchDescription: "Find your perfect car among thousands of offers. Filters, comparisons, and detailed specifications.",
        listingTitle: "{{make}} {{model}} {{version}} {{year}} - {{price}} | AutoFinder",
        listingDescription: "{{make}} {{model}} {{version}}, {{year}}, {{mileage}} km, {{fuel}}, {{power}} hp. Check offer details.",
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
        error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
        retry: "Erneut versuchen",
      },
      
      // Validation
      validation: {
        required: "Dieses Feld ist erforderlich",
        invalidEmail: "Ungültige E-Mail-Adresse",
        invalidPhone: "Ungültige Telefonnummer",
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
        searchTitle: "Fahrzeugsuche | AutoFinder",
        searchDescription: "Finden Sie Ihr perfektes Auto unter tausenden Angeboten. Filter, Vergleiche und detaillierte Spezifikationen.",
        listingTitle: "{{make}} {{model}} {{version}} {{year}} - {{price}} | AutoFinder",
        listingDescription: "{{make}} {{model}} {{version}}, {{year}}, {{mileage}} km, {{fuel}}, {{power}} PS. Angebotsdetails prüfen.",
      },
    },
  },
};
