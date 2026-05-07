import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { useTrackedUrl } from '@/hooks/useTrackedUrl';

const B2B_BADGE = 'Partner TU Link4';
const B2B_SUBTITLE_HTML =
  'Samochody nowe i używane od sprawdzonych dealerów.<br/>Kompleksowe wsparcie w wyborze pojazdu, finansowaniu i szybkim odzyskaniu auta po szkodzie całkowitej.';

export function B2BHero() {
  const { config } = useBrand();
  const hero = config.homePage?.hero;
  const ctaHref = useTrackedUrl('/samochody');

  if (!hero) return null;

  return (
    <section className="home-hero">
      <div className="home-hero__inner">
        <div>
          <div className="home-hero__badge">{B2B_BADGE}</div>
          <h1 dangerouslySetInnerHTML={{ __html: hero.title }} />
          <p
            className="home-hero__sub"
            dangerouslySetInnerHTML={{ __html: B2B_SUBTITLE_HTML }}
          />
          <div className="home-hero__actions">
            <Link to={ctaHref} className="home-btn-primary">
              {hero.ctaLabel}
            </Link>
          </div>
          <div className="home-hero__trust">
            {hero.trustBadges.map((badge, idx) => (
              <span key={idx}>
                <CheckCircle2 size={16} /> {badge}
              </span>
            ))}
          </div>
        </div>
        <div className="home-hero__visual">
          <img src={hero.image} alt={`${config.name} - auta`} />
          <div className="home-hero__stat home-hero__stat--left">
            <strong>{hero.stats[0].value}</strong>
            <small>{hero.stats[0].label}</small>
          </div>
          <div className="home-hero__stat home-hero__stat--right">
            <strong>{hero.stats[1].value}</strong>
            <small>{hero.stats[1].label}</small>
          </div>
        </div>
      </div>
    </section>
  );
}
