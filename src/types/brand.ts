export interface BrandColors {
  primary: string;
  primaryHover?: string;
  primaryForeground?: string;  // text on primary bg (defaults to white)
  accent: string;
  accentHover?: string;
  accentForeground?: string;   // text on accent bg (defaults to white)
}

export interface BrandFonts {
  /** Krój nagłówkowy — wstrzykiwany do --font-heading. */
  heading?: string;
  /** Krój interfejsu/treści — wstrzykiwany do --font-body. */
  body?: string;
}

export interface HeroConfig {
  badge: string;
  title: string; // use <span> for highlighting
  seoH1?: string;
  subtitle: string;
  ctaLabel: string;
  image: string;
  trustBadges: string[];
  stats: { value: string; label: string }[];
}

export interface TrustBarItem {
  icon: 'Shield' | 'CreditCard' | 'FileText' | 'Phone';
  label: string;
}

export interface StepConfig {
  title: string;
  description: string;
}

export interface StepsSection {
  tag: string;
  title: string; // use <span> for highlighting
  subtitle: string;
  items: StepConfig[];
}

export interface ContactPageConfig {
  title: string;
  subtitle: string;
  ctaTitle: string;
  ctaSubtitle: string;
}

export interface ContactInfo {
  phone: string;
  email: string;
}

/** Dane rejestrowe spółki — zapas dla stopek, gdy ustawienia serwisu są puste. */
export interface CompanyInfo {
  legalName: string;
  address: string;
  vatId: string;
  registerNumber: string;
}

export interface BrandLogo {
  header?: string;
  footer?: string;
}

export interface BrandConfig {
  id: string;
  name: string;
  domain: string;
  colors: BrandColors;
  fonts?: BrandFonts;
  contactInfo: ContactInfo;
  companyInfo?: CompanyInfo;
  logo?: BrandLogo;
  homePage: {
    hero: HeroConfig;
    trustBar: TrustBarItem[];
    steps: StepsSection;
  };
  contactPage: ContactPageConfig;
  features: Record<string, boolean>;
}
