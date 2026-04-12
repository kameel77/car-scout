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
import { useBrand } from '@/contexts/BrandContext';
import './home-page.css';



export default function HomePage() {
  const { config } = useBrand();
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
            <div className="home-hero__badge">{config.homePage.hero.badge}</div>
            <h1 dangerouslySetInnerHTML={{ __html: config.homePage.hero.title }} />
            <p className="home-hero__sub">
              {config.homePage.hero.subtitle}
            </p>
            <div className="home-hero__actions">
              <Link to="/samochody" className="home-btn-primary">{config.homePage.hero.ctaLabel}</Link>
            </div>
            <div className="home-hero__trust">
              {config.homePage.hero.trustBadges.map((badge, idx) => (
                <span key={idx}><CheckCircle2 size={16} /> {badge}</span>
              ))}
            </div>
          </div>
          <div className="home-hero__visual">
            <img src={config.homePage.hero.image} alt={`${config.name} - auta`} />
            <div className="home-hero__stat home-hero__stat--left">
              <strong>{config.homePage.hero.stats[0].value}</strong>
              <small>{config.homePage.hero.stats[0].label}</small>
            </div>
            <div className="home-hero__stat home-hero__stat--right">
              <strong>{config.homePage.hero.stats[1].value}</strong>
              <small>{config.homePage.hero.stats[1].label}</small>
            </div>
          </div>
        </div>
      </section>

      <section className="home-trust-bar home-reveal">
        <div className="home-trust-bar__inner">
          {config.homePage.trustBar.map((item, idx) => (
            <div key={idx}>
              <span className="icon-box">
                {item.icon === 'Shield' && <Shield size={20} />}
                {item.icon === 'CreditCard' && <CreditCard size={20} />}
                {item.icon === 'FileText' && <FileText size={20} />}
                {item.icon === 'Phone' && <Phone size={20} />}
              </span>
              {item.label}
            </div>
          ))}
        </div>
      </section>

      <section className="home-section" id="jak-to-dziala">
        <div className="home-section__header home-reveal">
          <span className="home-section__tag">{config.homePage.steps.tag}</span>
          <h2 dangerouslySetInnerHTML={{ __html: config.homePage.steps.title }} />
          <p>{config.homePage.steps.subtitle}</p>
        </div>
        <div className="home-steps-grid">
          {config.homePage.steps.items.map((item, index) => (
            <article key={index} className="home-step-card home-reveal">
              <div className="home-step-card__header">
                <div className="home-step-card__number">{index + 1}</div>
                <h3>{item.title}</h3>
              </div>
              <p>{item.description}</p>
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
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const phoneInput = form.querySelector('input[type="tel"]') as HTMLInputElement;
              const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;
              const phone = phoneInput.value;

              if (!phone) return;

              try {
                button.disabled = true;
                const originalText = button.innerHTML;
                button.innerHTML = 'Wysyłanie...';

                await leadsApi.submitQuickLead({ phone });

                button.innerHTML = 'Wysłano pomyślnie!';
                button.style.backgroundColor = '#10b981';
                button.style.color = 'white';
                phoneInput.value = '';

                setTimeout(() => {
                  button.disabled = false;
                  button.innerHTML = originalText;
                  button.style.backgroundColor = '';
                  button.style.color = '';
                }, 3000);
              } catch (error) {
                console.error('Failed to submit quick contact form:', error);
                alert('Wystąpił błąd podczas wysyłania formularza. Spróbuj ponownie.');
                button.disabled = false;
                button.innerHTML = 'Zadzwoń do mnie';
              }
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
