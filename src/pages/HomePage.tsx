import React from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '@/components/Footer';
import { LandingHeader } from '@/components/LandingHeader';
import './home-page.css';

export default function HomePage() {
  React.useEffect(() => {
    const onScroll = () => {
      const nav = document.getElementById('landing-nav');
      if (!nav) return;
      nav.classList.toggle('scrolled', window.scrollY > 10);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.home-reveal').forEach((el) => observer.observe(el));
    window.addEventListener('scroll', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="landing-page-root">
      <LandingHeader />

      <section className="home-hero">
        <div className="home-hero__inner">
          <div>
            <div className="home-hero__badge">Nowy sposób na zakup auta</div>
            <h1>Twoje nowe auto<br />jest <span>bliżej</span> niż myślisz</h1>
            <p className="home-hero__sub">
              Samochody nowe i używane od sprawdzonych dealerów. Pomożemy Ci wybrać,
              sfinansować i kupić auto — bez zbędnych formalności.
            </p>
            <div className="home-hero__actions">
              <Link to="/samochody" className="home-btn-primary">Znajdź auto</Link>
              <Link to="/kontakt" className="home-btn-secondary">Skontaktuj się</Link>
            </div>
            <div className="home-hero__trust">
              <span>Bez ukrytych kosztów</span>
              <span>Gwarancja na każde auto</span>
              <span>Oddzwonimy w 15 min</span>
            </div>
          </div>
          <div className="home-hero__visual">
            <img src="/why-us-illustration.svg" alt="CarSalon - auta" />
            <div className="home-hero__stat home-hero__stat--left">
              <strong>2 500+</strong>
              <small>aut w ofercie</small>
            </div>
            <div className="home-hero__stat home-hero__stat--right">
              <strong>98%</strong>
              <small>zadowolonych klientów</small>
            </div>
          </div>
        </div>
      </section>

      <section className="home-trust-bar home-reveal">
        <div className="home-trust-bar__inner">
          <div>Sprawdzeni dealerzy</div>
          <div>Elastyczne finansowanie</div>
          <div>Gwarancja na każde auto</div>
          <div>Osobisty konsultant</div>
        </div>
      </section>

      <section className="home-section" id="jak-to-dziala">
        <div className="home-section__header home-reveal">
          <span className="home-section__tag">Prosty proces</span>
          <h2>Jak <span>kupić auto</span> z CarSalon?</h2>
        </div>
        <div className="home-steps-grid">
          {[
            ['1', 'Zostaw kontakt', 'Podaj numer telefonu, oddzwonimy i ustalimy potrzeby.'],
            ['2', 'Dopasujemy ofertę', 'Wybierzemy najlepsze auta od sprawdzonych dealerów.'],
            ['3', 'Dobierzemy finansowanie', 'Leasing, kredyt lub wynajem — dopasowane do Ciebie.'],
            ['4', 'Odbierz kluczyki', 'Formalności załatwiamy za Ciebie, Ty odbierasz auto.'],
          ].map(([step, title, desc]) => (
            <article key={step} className="home-step-card home-reveal">
              <div className="home-step-card__number">{step}</div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-section--white" id="dlaczego-my">
        <div className="home-section__header home-reveal">
          <span className="home-section__tag">Dlaczego my</span>
          <h2>Kupujesz z <span>pewnością</span></h2>
        </div>
        <div className="home-why-grid">
          {[
            ['Zweryfikowani dealerzy', 'Każde auto ma potwierdzoną historię i stan techniczny.'],
            ['Zero ukrytych kosztów', 'Cena jest jasna od początku do końca.'],
            ['Osobisty konsultant', 'Dedykowane wsparcie od wyboru po odbiór auta.'],
            ['Elastyczne finansowanie', 'Leasing, kredyt i wynajem pod Twoją sytuację.'],
            ['Gwarancja na każde auto', 'Nowe i używane auta z gwarancją bezpieczeństwa.'],
            ['Szybko i wygodnie', 'Mniej formalności, więcej konkretów.'],
          ].map(([title, desc]) => (
            <article key={title} className="home-why-card home-reveal">
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-cta-section" id="kontakt">
        <div className="home-cta-box home-reveal">
          <h2>Gotowy na <span>swoje nowe auto</span>?</h2>
          <p>Zostaw kontakt i znajdźmy razem ofertę idealną dla Ciebie.</p>
          <Link to="/samochody" className="home-btn-primary">Znajdź auto</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
