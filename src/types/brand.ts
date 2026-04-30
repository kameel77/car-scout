export interface BrandColors {
  primary: string;
  primaryHover?: string;
  primaryForeground?: string;  // text on primary bg (defaults to white)
  accent: string;
  accentHover?: string;
  accentForeground?: string;   // text on accent bg (defaults to white)
}

export interface HeroConfig {
  badge: string;
  title: string; // use <span> for highlighting
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

export interface BrandLogo {
  header?: string;
  footer?: string;
}

export interface BrandConfig {
  id: string;
  name: string;
  domain: string;
  colors: BrandColors;
  contactInfo: ContactInfo;
  logo?: BrandLogo;
  homePage: {
    hero: HeroConfig;
    trustBar: TrustBarItem[];
    steps: StepsSection;
  };
  contactPage: ContactPageConfig;
}
