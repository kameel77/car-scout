import { Link } from 'react-router-dom';
import { Phone, Mail } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { useBrand } from '@/contexts/BrandContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { formatPhoneForTelLink } from '@/utils/formatters';
import './home-page.css';

export default function CarsalonContactPage() {
  const { config } = useBrand();
  const { data: settings } = useAppSettings();
  const salesPhone = settings?.salesContactPhone || settings?.legalContactPhone || config.contactInfo.phone;
  return (
    <div className="landing-page-root">
      <Header />

      <section className="home-hero">
        <div className="home-hero__inner" style={{ gridTemplateColumns: '1fr' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
            <div className="home-hero__badge">Kontakt</div>
            <h1 dangerouslySetInnerHTML={{ __html: config.contactPage.title }} />
            <p className="home-hero__sub" style={{ marginInline: 'auto' }}>
              {config.contactPage.subtitle}
            </p>
            <div className="home-hero__actions" style={{ justifyContent: 'center' }}>
              <a href={`tel:${formatPhoneForTelLink(salesPhone)}`} className="home-btn-secondary">
                <Phone size={18} />&nbsp; {salesPhone}
              </a>
              <a href={`mailto:${config.contactInfo.email}`} className="home-btn-secondary">
                <Mail size={18} />&nbsp; {config.contactInfo.email}
              </a>
            </div>
            <div className="home-cta-box" style={{ marginTop: 24 }}>
              <h2 dangerouslySetInnerHTML={{ __html: config.contactPage.ctaTitle }} />
              <p>{config.contactPage.ctaSubtitle}</p>
              <Link to="/samochody" className="home-btn-primary">Znajdź auto</Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
