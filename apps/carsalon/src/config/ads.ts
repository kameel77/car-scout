export interface PartnerAd {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    ctaText: string;
    url: string;
    brandName?: string;
    features?: string[];
    subtitle?: string;
}

export const ADS_CONFIG = {
    // ADS on Search Page grid (In-Feed)
    searchGridAds: [
        {
            id: "search-insurance-1",
            title: "Ubezpieczenie OC/AC z rabatem do 20%",
            description: "Porównaj oferty 30 towarzystw i znajdź najtańszą polisę dla Twojego nowego samochodu.",
            ctaText: "Sprawdź ceny",
            url: "#",
            brandName: "Link4",
            imageUrl: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=800",
        }
    ],

    // Top Banner on Search Page
    searchTopBanner: {
        id: "search-top-financing",
        title: "Najlepsze Finansowanie dla Twojej Firmy",
        subtitle: "Sprawdź ofertę leasingu operacyjnego z ratą od 101%.",
        ctaText: "Oblicz Ratę",
        url: "#",
        imageUrl: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&q=80&w=1200",
    },

    // Detail Page Ads (Sidebar & Mobile content)
    detailSidebarAds: [
        {
            id: "detail-warranty-1",
            title: "Rozszerzona Gwarancja dla Twojego Auta",
            description: "Zabezpiecz się przed nieprzewidzianymi kosztami napraw nawet do 36 miesięcy.",
            ctaText: "Poznaj pakiety",
            url: "#",
            features: [
                "Ochrona silnika i skrzyni biegów",
                "Bezgotówkowe naprawy w całej Polsce",
                "Auto zastępcze na czas naprawy"
            ],
            brandName: "Defend Insurance",
        }
    ]
};
