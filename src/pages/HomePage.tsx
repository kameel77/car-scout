import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  CreditCard,
  FileText,
  Phone,
  CheckCircle2,
  Star,
  ChevronDown,
  User,
  BadgeCheck,
  CircleX,
  Clock3,
  CarFront,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { faqApi } from '@/services/api';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import './home-page.css';



export default function HomePage() {
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);
  const { i18n } = useTranslation();

  const { data: faqData } = useQuery({
    queryKey: ['home-faq'],
    queryFn: async () => {
      const response = await faqApi.list({ page: 'home' });
      return (response.entries || [])
        .filter((e: any) => e.isPublished)
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
  });

  const getLocalized = (item: any, field: string) => {
    const langCode = i18n.language.slice(0, 2).toLowerCase();
    const suffix = langCode === 'pl' ? 'Pl' : langCode === 'en' ? 'En' : 'De';
    return item[`${field}${suffix}`] || '';
  };

  const dynamicFaqs = React.useMemo(() => {
    if (!faqData) return [];
    const langCode = i18n.language.slice(0, 2).toLowerCase();
    const suffix = langCode === 'pl' ? 'Pl' : langCode === 'en' ? 'En' : 'De';

    return faqData.filter((item: any) => {
      const hasQ = item[`question${suffix}`]?.trim();
      const hasA = item[`answer${suffix}`]?.trim();
      return hasQ && hasA;
    }).map((item: any) => ({
      id: item.id,
      q: getLocalized(item, 'question'),
      a: getLocalized(item, 'answer')
    }));
  }, [faqData, i18n.language]);

  React.useEffect(() => {
    const onScroll = () => {
      const nav = document.getElementById('landing-nav');
      if (!nav) return;
      nav.classList.toggle('scrolled', window.scrollY > 10);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), index * 70);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.home-reveal').forEach((el) => observer.observe(el));
    window.addEventListener('scroll', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [dynamicFaqs.length]);

  return (
    <div className="landing-page-root">
      <Header />

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
            </div>
            <div className="home-hero__trust">
              <span><CheckCircle2 size={16} /> Bez ukrytych kosztów</span>
              <span><CheckCircle2 size={16} /> Gwarancja na każde auto</span>
              <span><CheckCircle2 size={16} /> Oddzwonimy w 15 min</span>
            </div>
          </div>
          <div className="home-hero__visual">
            <img src="https://krqwvegfxnlwdhgjuflh.supabase.co/storage/v1/object/public/public-img/car-salon-hero.jpg" alt="CarSalon - auta" />
            <div className="home-hero__stat home-hero__stat--left">
              <strong>500+</strong>
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
          <div><span className="icon-box"><Shield size={20} /></span>Sprawdzeni dealerzy</div>
          <div><span className="icon-box"><CreditCard size={20} /></span>Elastyczne finansowanie</div>
          <div><span className="icon-box"><FileText size={20} /></span>Gwarancja na każde auto</div>
          <div><span className="icon-box"><Phone size={20} /></span>Osobisty konsultant</div>
        </div>
      </section>

      <section className="home-section" id="jak-to-dziala">
        <div className="home-section__header home-reveal">
          <span className="home-section__tag">Prosty proces</span>
          <h2>Jak <span>kupić auto</span> z CarSalon?</h2>
          <p>Cały proces zakupu trwa kilka dni. Ty wybierasz - my załatwiamy formalności.</p>
        </div>
        <div className="home-steps-grid">
          {[
            ['1', 'Zostaw kontakt', 'Podaj numer telefonu, a konsultant oddzwoni i pozna Twoje potrzeby.'],
            ['2', 'Dopasujemy ofertę', 'Wybierzemy auta od sprawdzonych dealerów dopasowane do Ciebie.'],
            ['3', 'Dobierzemy finansowanie', 'Leasing, kredyt lub wynajem - dobierzemy najlepszą opcję.'],
            ['4', 'Odbierz kluczyki', 'Formalności ogarniamy za Ciebie, Ty odbierasz gotowe auto.'],
          ].map(([step, title, desc]) => (
            <article key={step} className="home-step-card home-reveal">
              <div className="home-step-card__header">
                <div className="home-step-card__number">{step}</div>
                <h3>{title}</h3>
              </div>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-section--white" id="dlaczego-my">
        <div className="home-section__header home-reveal">
          <span className="home-section__tag">Dlaczego my</span>
          <h2>Kupujesz z <span>pewnością</span></h2>
          <p>Wiemy, że zakup samochodu to ważna decyzja. Dlatego dbamy o bezpieczeństwo na każdym etapie.</p>
        </div>
        <div className="home-why-grid">
          {[
            [<Shield key="a" size={24} />, 'Zweryfikowani dealerzy', 'Każde auto ma potwierdzoną historię i stan techniczny.'],
            [<CircleX key="b" size={24} />, 'Zero ukrytych kosztów', 'Cena jest jasna od początku do końca.'],
            [<User key="c" size={24} />, 'Osobisty konsultant', 'Dedykowane wsparcie od wyboru po odbiór auta.'],
            [<CreditCard key="d" size={24} />, 'Elastyczne finansowanie', 'Leasing, kredyt i wynajem dopasowane do sytuacji.'],
            [<BadgeCheck key="e" size={24} />, 'Gwarancja na każde auto', 'Nowe i używane pojazdy objęte gwarancją.'],
            [<Clock3 key="f" size={24} />, 'Szybko i wygodnie', 'Mniej formalności, więcej konkretów i szybsza decyzja.'],
          ].map(([icon, title, desc]) => (
            <article key={title as string} className="home-why-card home-reveal">
              <div className="home-why-icon">{icon as React.ReactNode}</div>
              <h3>{title as string}</h3>
              <p>{desc as string}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section" id="oferta">
        <div className="home-section__header home-reveal">
          <span className="home-section__tag">Oferta</span>
          <h2>Nowe i <span>używane</span>. Po prostu wybierz</h2>
          <p>W naszej ofercie znajdziesz setki pojazdów od zaufanych dealerów w całej Polsce.</p>
        </div>
        <div className="home-offer-grid">
          <article className="home-offer-card home-reveal">
            <div className="home-offer-icon"><Star size={28} /></div>
            <div>
              <h3>Samochody nowe</h3>
              <p>Najnowsze modele prosto od dealerów, gwarancja producenta, konfiguracja pod Ciebie.</p>
            </div>
          </article>
          <article className="home-offer-card home-reveal">
            <div className="home-offer-icon home-offer-icon--dark"><BadgeCheck size={28} /></div>
            <div>
              <h3>Samochody używane</h3>
              <p>Sprawdzone auta po weryfikacji technicznej i prawnej, z gwarancją CarSalon.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="home-section home-section--white">
        <div className="home-section__header home-reveal">
          <span className="home-section__tag">Opinie klientów</span>
          <h2>Zaufali <span>nam</span></h2>
          <p>Zobacz, co mówią o nas klienci, którzy mieli okazję z nami współpracować.</p>
        </div>
        <div className="home-testimonials-grid">
          {[
            ['PM', 'Piotr M.', 'BMW 520d · Leasing', 'Konsultant dobrał idealne auto i pomógł z leasingiem, szybko i konkretnie.'],
            ['MT', 'Monika T.', 'Audi Q2 TFSI · Kredyt', 'Pierwszy zakup auta bez stresu. Wszystko jasno wyjaśnione krok po kroku.'],
            ['TW', 'Tomasz W.', '3x Škoda Octavia · Leasing', 'Potrzebowałem 3 aut do firmy. Doradca ogarnął to sprawnie i na dobrych warunkach.'],
          ].map(([avatar, name, car, text]) => (
            <article key={name as string} className="home-testimonial-card home-reveal">
              <div className="home-stars">★★★★★</div>
              <p>“{text as string}”</p>
              <div className="home-author"><span>{avatar as string}</span><div><strong>{name as string}</strong><small>{car as string}</small></div></div>
            </article>
          ))}
        </div>
      </section>

      {dynamicFaqs.length > 0 && (
        <section className="home-section" id="faq">
          <div className="home-section__header home-reveal">
            <span className="home-section__tag">FAQ</span>
            <h2>Masz <span>pytania</span>?</h2>
            <p>Odpowiadamy na najczęściej zadawane pytania naszych klientów.</p>
          </div>
          <div className="home-faq-list">
            {dynamicFaqs.map((item, idx) => (
              <div className={`home-faq-item ${openFaq === idx ? 'open' : ''}`} key={item.id}>
                <button onClick={() => setOpenFaq(openFaq === idx ? null : idx)} className="home-faq-question">
                  <h3>{item.q}</h3>
                  <ChevronDown size={18} />
                </button>
                <div className="home-faq-answer"><p>{item.a}</p></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="home-cta-section" id="kontakt">
        <div className="home-cta-box home-reveal">
          <h2>Gotowy na <span>swoje nowe auto</span>?</h2>
          <p>Zostaw numer — oddzwonimy w ciągu 15 minut i pomożemy Ci znaleźć idealne auto.</p>
          <form
            className="home-cta-form"
            onSubmit={(e) => {
              e.preventDefault();
              alert('Dziękujemy! Odezwiemy się wkrótce.');
            }}
          >
            <input type="tel" placeholder="Twój numer telefonu" required />
            <button type="submit" className="home-btn-primary">
              <CarFront size={18} />&nbsp;Zadzwoń do mnie
            </button>
          </form>
          <p className="home-cta-note">Bezpłatnie i bez zobowiązań. Obsługujemy klientów w całej Polsce.</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
