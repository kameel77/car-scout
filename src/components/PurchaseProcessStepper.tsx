import React from 'react';
import { Link } from 'react-router-dom';
import './PurchaseProcessStepper.css';
import {
  Search,
  PhoneIncoming,
  FileText,
  PenLine,
  Car,
  Fuel,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

// ─── Step Data ───────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: Search,
    title: 'Wybierz auto i policz ratę',
    description:
      'Przeglądaj ofertę, wybierz model i sprawdź wstępną kalkulację finansowania.',
  },
  {
    icon: PhoneIncoming,
    title: 'Konsultant oddzwania',
    description:
      'Nasz doradca skontaktuje się, odpowie na pytania i pomoże doprecyzować ofertę.',
  },
  {
    icon: FileText,
    title: 'Wniosek o finansowanie',
    description:
      'Wypełnij krótki wniosek - pomożemy Ci z formalnościami.',
  },
  {
    icon: PenLine,
    title: 'Podpisz umowę',
    description:
      'Finalizacja warunków i podpisanie umowy - szybko i wygodnie.',
  },
  {
    icon: Car,
    secondaryIcon: Fuel,
    title: 'Odbierz auto i kartę paliwową',
    description:
      'Gotowe! Odbierasz kluczyki i ruszasz w drogę.',
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface PurchaseProcessStepperProps {
  /** "full" = full section with header for homepage; "compact" = minimal version for detail pages */
  variant?: 'full' | 'compact';
  /** Optional className for the root element */
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PurchaseProcessStepper({
  variant = 'full',
  className = '',
}: PurchaseProcessStepperProps) {
  const isCompact = variant === 'compact';
  const sectionRef = React.useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="jak-to-dziala"
      className={`purchase-process ${isCompact ? 'purchase-process--compact' : ''} ${className}`}
    >
      <div className="purchase-process__container">
        {/* Header — only in full variant */}
        {!isCompact && (
          <div className={`purchase-process__header ${isVisible ? 'is-visible' : ''}`}>
            <span className="purchase-process__tag">Krok po kroku</span>
            <h2>
              Jak wygląda <span>proces zakupu</span>?
            </h2>
            <p>Od wyboru auta do odbioru kluczyków - 5 prostych kroków.</p>
          </div>
        )}

        {isCompact && (
          <div className={`purchase-process__header purchase-process__header--compact ${isVisible ? 'is-visible' : ''}`}>
            <h3>
              Jak wygląda <span>proces zakupu</span>?
            </h3>
          </div>
        )}

        {/* Timeline (1 row on desktop) */}
        <div className="purchase-process__timeline">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const SecondaryIcon = step.secondaryIcon;
            return (
              <div
                key={index}
                className={`purchase-process__step ${isVisible ? 'is-visible' : ''}`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {/* Icon Hub with Micro Step Badge */}
                <div className="purchase-process__icon-wrapper">
                  <div className="purchase-process__icon">
                    <Icon size={isCompact ? 20 : 26} strokeWidth={1.8} />
                    {SecondaryIcon && (
                      <SecondaryIcon
                        size={isCompact ? 13 : 15}
                        className="purchase-process__icon-secondary"
                      />
                    )}
                  </div>
                  <span className="purchase-process__step-badge" aria-hidden="true">
                    {index + 1}
                  </span>
                </div>

                {/* Connector Arrow to next step (steps 0..3) */}
                {index < STEPS.length - 1 && (
                  <div className="purchase-process__connector" aria-hidden="true">
                    <div className="purchase-process__connector-line" />
                    <div className="purchase-process__connector-arrow">
                      <ChevronRight size={isCompact ? 13 : 15} strokeWidth={2.5} />
                    </div>
                  </div>
                )}

                {/* Text Content */}
                <div className="purchase-process__content">
                  <h4 className="purchase-process__title">{step.title}</h4>
                  {!isCompact && (
                    <p className="purchase-process__desc">{step.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA — only in full variant */}
        {!isCompact && (
          <div className={`purchase-process__cta ${isVisible ? 'is-visible' : ''}`}>
            <Link to="/samochody" className="purchase-process__cta-btn">
              Wybierz auto <ArrowRight size={18} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
