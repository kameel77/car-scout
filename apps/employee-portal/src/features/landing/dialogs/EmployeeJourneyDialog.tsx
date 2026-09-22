import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BenefivoModal } from './BenefivoModal';
import { trackEvent } from '../../analytics/analytics';
import { useBrandConfig } from '../../../config/BrandContext';

export interface EmployeeJourneyDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const HR_MESSAGE =
  'Cześć! Chciałbym zaproponować wprowadzenie Benefivo - programu samochodowego powered by Motolia. Łączy najem i leasing aut z benefitami motoryzacyjnymi dla pracowników. Czy możemy sprawdzić możliwości uruchomienia takiego programu w naszej firmie?';

export const EmployeeJourneyDialog: React.FC<EmployeeJourneyDialogProps> = ({ isOpen, onClose }) => {
  const { config } = useBrandConfig();
  const [status, setStatus] = useState<string | null>(null);

  const handleCopy = async () => {
    trackEvent('copy_hr_message', {}, config.apiUrl, config.analyticsEnabled);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(HR_MESSAGE);
        setStatus('Skopiowano treść wiadomości. Wklej ją w e-mailu lub na Slacku do HR.');
      } else {
        setStatus('Zaznacz tekst ręcznie i skopiuj skrótem ⌘C lub Ctrl+C.');
      }
    } catch {
      setStatus('Zaznacz tekst ręcznie i skopiuj skrótem ⌘C lub Ctrl+C.');
    }
  };

  return (
    <BenefivoModal
      isOpen={isOpen}
      onClose={onClose}
      kicker="DLA PRACOWNIKA"
      title="Dobre rzeczy zaczynają się w firmie."
      description="Zapytaj swój dział HR o program samochodowy. Możesz wykorzystać przygotowaną poniżej propozycję wiadomości."
    >
      <label htmlFor="benefivo-hr-msg" className="eyebrow block mb-1">
        WIADOMOŚĆ DO HR
      </label>
      <textarea
        id="benefivo-hr-msg"
        className="benefivo-message-box"
        readOnly
        value={HR_MESSAGE}
      />
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          className="button button-dark"
          type="button"
          onClick={handleCopy}
        >
          Kopiuj wiadomość <span aria-hidden="true">&rarr;</span>
        </button>
        <Link
          to="/rejestracja"
          className="button button-outline text-xs"
          onClick={onClose}
        >
          Masz kod firmy? Aktywuj dostęp &rarr;
        </Link>
      </div>
      {status && (
        <p className="benefivo-dialog-status mt-3" role="status">
          {status}
        </p>
      )}
      <p className="fine-print mt-4">
        To szybka propozycja dla Twojego pracodawcy. Dostęp do katalogu otrzymasz natychmiast po uruchomieniu programu w Twojej organizacji.
      </p>
    </BenefivoModal>
  );
};
