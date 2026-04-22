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

        {/* Timeline */}
        <div className="purchase-process__timeline">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const SecondaryIcon = step.secondaryIcon;
            return (
              <div
                key={index}
                className={`purchase-process__step ${isVisible ? 'is-visible' : ''}`}
                style={{ transitionDelay: `${index * 120}ms` }}
              >
                {/* Connector line (between steps) */}
                {index < STEPS.length - 1 && (
                  <div className="purchase-process__connector" />
                )}

                {/* Number circle */}
                <div className="purchase-process__number">
                  {index + 1}
                </div>

                {/* Icon */}
                <div className="purchase-process__icon">
                  <Icon size={isCompact ? 20 : 24} />
                  {SecondaryIcon && (
                    <SecondaryIcon
                      size={isCompact ? 14 : 16}
                      className="purchase-process__icon-secondary"
                    />
                  )}
                </div>

                {/* Text */}
                <h4 className="purchase-process__title">{step.title}</h4>
                {!isCompact && (
                  <p className="purchase-process__desc">{step.description}</p>
                )}
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
