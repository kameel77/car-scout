export interface BrandColors {
  primary: string;
  primaryHover?: string;
  accent: string;
  accentHover?: string;
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

export interface BrandConfig {
  id: string;
  name: string;
  domain: string;
  colors: BrandColors;
  homePage: {
    hero: HeroConfig;
    trustBar: TrustBarItem[];
    steps: StepsSection;
  };
}
