import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, LockOpen } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useBrandConfig } from '../../../config/BrandContext';
import { validateCompanyCode } from '../../auth/auth-api';
import { useTrack } from '../../analytics/useTrack';
import { PROGRAM_FIGURES_AS_OF, SAMPLE_OFFERS } from '../content/marketing';

export interface SampleOffersProps {
  onOpenEmployeeDialog: () => void;
}

/**
 * Sample offers teaser. For guests, prices are blurred until a company code is verified.
 * The blur is an incentive only: these example prices are public.
 */
export const SampleOffers: React.FC<SampleOffersProps> = ({ onOpenEmployeeDialog }) => {
  const { isAuthenticated } = useAuth();
  const { config } = useBrandConfig();
  const track = useTrack();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'locked' | 'checking' | 'unlocked'>('locked');
  const [error, setError] = useState<string | null>(null);

  const unlocked = isAuthenticated || status === 'unlocked';
  const normalizedCode = code.trim().toUpperCase();

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'unlocked') {
      navigate(`/rejestracja?kod=${encodeURIComponent(normalizedCode)}`);
      return;
    }
    if (!normalizedCode) {
      setError('Wpisz kod z maila od HR.');
      return;
    }
    setError(null);
    setStatus('checking');
    track('unlock_code_submit');
    try {
      const result = await validateCompanyCode(config.apiUrl, normalizedCode);
      if (!result.valid) throw new Error('Kod dostępu jest nieprawidłowy.');
      setStatus('unlocked');
      track('unlock_code_success');
    } catch (err: unknown) {
      setStatus('locked');
      setError(err instanceof Error ? err.message : 'Nie udało się sprawdzić kodu.');
      track('unlock_code_error');
    }
  };

  return (
    <section id="oferty" className="wrap scroll-mt-8" aria-labelledby="sample-offers-title">
      <div className="bg-forest text-paper rounded-3xl px-6 py-10 sm:px-12 sm:py-14 flex flex-col gap-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-xl flex flex-col gap-3">
            <p className="eyebrow !text-lime">PRZYKŁADOWE AUTA W PROGRAMIE</p>
            <h2 id="sample-offers-title" className="!text-paper">
              {unlocked ? 'Przykładowe auta w programie' : 'Twoje ceny czekają za kodem firmy.'}
            </h2>
            {!unlocked && (
              <p className="text-[#C9D3C4]">
                Wpisz kod z maila od HR, a zobaczysz raty i ceny przygotowane dla Twojego zespołu.
              </p>
            )}
          </div>

          {!isAuthenticated && (
            <form onSubmit={handleUnlock} className="w-full lg:w-[420px] flex flex-col gap-2" noValidate>
              <label htmlFor="unlock-code" className="text-xs font-bold uppercase tracking-wider text-[#C9D3C4]">
                Kod dostępu firmy
              </label>
              <div className="flex gap-2">
                <input
                  id="unlock-code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  disabled={status === 'unlocked'}
                  autoComplete="off"
                  aria-invalid={!!error}
                  aria-describedby="unlock-code-hint"
                  className="flex-1 min-w-0 rounded-full bg-ink text-paper border border-muted px-5 min-h-[52px] placeholder:text-[#9AA394]"
                  placeholder="np. FIRMA-2026"
                />
                <button
                  type="submit"
                  disabled={status === 'checking'}
                  className="button button-lime whitespace-nowrap inline-flex items-center gap-2"
                >
                  {unlocked ? <LockOpen className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
                  {status === 'unlocked' ? 'Załóż konto' : status === 'checking' ? 'Sprawdzam...' : 'Odblokuj ceny'}
                </button>
              </div>
              <p id="unlock-code-hint" className={`text-sm min-h-[20px] ${error ? 'text-[#F5C2AE]' : 'text-[#C9D3C4]'}`} role={error ? 'alert' : undefined}>
                {error ? (
                  error
                ) : status === 'unlocked' ? (
                  'Gotowe. Tak wyglądają ceny w Twoim programie.'
                ) : (
                  <>
                    Nie masz kodu?{' '}
                    <button type="button" className="underline text-paper" onClick={onOpenEmployeeDialog}>
                      Zapytaj HR
                    </button>
                  </>
                )}
              </p>
            </form>
          )}
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SAMPLE_OFFERS.map((offer, i) => {
            const priceBlock = (
              <div className="border-t border-line pt-3 flex flex-col gap-1">
                <span className="text-xs text-muted">{offer.priceLabel}</span>
                {unlocked ? (
                  <>
                    <span
                      className="font-heading text-3xl font-extrabold tracking-tight bf-unlocked"
                      style={{ transitionDelay: `${i * 180}ms` }}
                    >
                      {offer.price}
                    </span>
                    <span className="text-xs text-muted bf-unlocked" style={{ transitionDelay: `${i * 180}ms` }}>
                      {offer.note}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-heading text-3xl font-extrabold tracking-tight bf-locked" aria-hidden="true">
                      {offer.price}
                    </span>
                    <span className="text-xs text-muted bf-locked" aria-hidden="true">
                      {offer.note}
                    </span>
                    <span className="sr-only">Cena widoczna po podaniu kodu firmy.</span>
                  </>
                )}
              </div>
            );
            const card = (
              <div className="h-full bg-paper text-ink rounded-3xl p-5 flex flex-col gap-3">
                <div className="h-40 rounded-2xl bg-[#EEF1E8] overflow-hidden">
                  <img src={offer.imageUrl} alt={offer.title} loading="lazy" className="h-full !object-contain" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-heading text-xl font-bold tracking-tight">{offer.title}</h3>
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${offer.kind === 'financing' ? 'bg-lime' : 'bg-[#E6E2F2]'}`}>
                    {offer.tag}
                  </span>
                </div>
                <p className="text-sm text-muted">{offer.subtitle}</p>
                {priceBlock}
              </div>
            );
            return (
              <li key={offer.offerPath}>
                <Link
                  to={
                    isAuthenticated
                      ? offer.offerPath
                      : status === 'unlocked'
                        ? `/rejestracja?kod=${encodeURIComponent(normalizedCode)}`
                        : '/rejestracja'
                  }
                  className="block h-full rounded-3xl"
                  onClick={() => track('sample_offer_click', { offer: offer.title })}
                >
                  {card}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-[#C9D3C4]">
          Przykłady z oferty programu, {PROGRAM_FIGURES_AS_OF}. Raty najmu brutto „od”, zależne od przebiegu i okresu. Rabat na nowe auta liczony od ceny katalogowej. Ceny mogą się zmieniać.
        </p>
      </div>
    </section>
  );
};
