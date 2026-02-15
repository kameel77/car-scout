import { Link } from 'react-router-dom';
import { Phone, Mail } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import './home-page.css';

export default function ContactPage() {
  return (
    <div className="landing-page-root">
      <Header />

      <section className="home-hero">
        <div className="home-hero__inner" style={{ gridTemplateColumns: '1fr' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
            <div className="home-hero__badge">Kontakt</div>
            <h1>Porozmawiajmy o <span>Twoim nowym aucie</span></h1>
            <p className="home-hero__sub" style={{ marginInline: 'auto' }}>
              Zostaw kontakt, a doradca CarSalon oddzwoni i przeprowadzi Cię przez cały proces: wybór auta, finansowanie i formalności.
            </p>
            <div className="home-hero__actions" style={{ justifyContent: 'center' }}>
              <a href="tel:+48123456789" className="home-btn-secondary"><Phone size={18} />&nbsp; +48 123 456 789</a>
              <a href="mailto:kontakt@carsalon.pl" className="home-btn-secondary"><Mail size={18} />&nbsp; kontakt@carsalon.pl</a>
            </div>
            <div className="home-cta-box" style={{ marginTop: 24 }}>
              <h2>Gotowy na <span>kolejny krok</span>?</h2>
              <p>Przejdź do listy ofert i wybierz auto, które chcesz omówić z konsultantem.</p>
              <Link to="/samochody" className="home-btn-primary">Znajdź auto</Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
