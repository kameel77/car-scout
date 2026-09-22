import React from 'react';
import { BenefivoModal } from './BenefivoModal';

export interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  return (
    <BenefivoModal
      isOpen={isOpen}
      onClose={onClose}
      kicker="O PROGRAMIE BENEFIVO"
      title="Nowoczesny benefit motoryzacyjny."
      description="Benefivo to program samochodowy udostępniany pracownikom przez pracodawców we współpracy z operatorem technologicznym Motolia Sp. z o.o."
    >
      <p className="text-sm leading-relaxed text-stone-600">
        Serwis benefivo.pl umożliwia pracownikom zapoznanie się z ideą programu, zgłoszenie zapotrzebowania do działu HR oraz bezpośrednie logowanie do spersonalizowanego katalogu ofert floty partnerów.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href="/brand.html"
          target="_blank"
          rel="noopener noreferrer"
          className="button button-outline text-xs"
        >
          Zobacz Brand Book &rarr;
        </a>
        <a
          href="/Benefivo-Brand-Book.pdf"
          download
          className="button button-outline text-xs"
        >
          Pobierz Brand Book PDF
        </a>
      </div>
    </BenefivoModal>
  );
};
