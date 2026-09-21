import React from 'react';
import { BenefivoModal } from './BenefivoModal';

export interface LeasingDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEmployee: () => void;
}

export const LeasingDetailsDialog: React.FC<LeasingDetailsDialogProps> = ({
  isOpen,
  onClose,
  onOpenEmployee,
}) => {
  return (
    <BenefivoModal
      isOpen={isOpen}
      onClose={onClose}
      kicker="LEASING SAMOCHODÓW"
      title="Twoje plany. Twoje warunki."
      description="Finansowanie samochodu z możliwością wykupu na własność na zakończenie umowy. Rozwiązanie dopasowane do Twojego profilu zatrudnienia lub działalności gospodarczej."
    >
      <ul>
        <li>Elastycznie dobierana wpłata początkowa, okres umowy oraz końcowa wartość wykupu.</li>
        <li>Weryfikacja zdolności finansowej realizowana sprawnie i w 100% online przez renomowanych partnerów finansujących.</li>
        <li>Wszystkie koszty oraz warunki przedstawiane czarno na białym przed podpisaniem umowy.</li>
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="button button-dark"
          type="button"
          onClick={() => {
            onClose();
            onOpenEmployee();
          }}
        >
          Jak skorzystać w mojej firmie? &rarr;
        </button>
      </div>
      <p className="fine-print mt-4">
        Każda umowa leasingowa podlega standardowej procedurze weryfikacji przez instytucję finansującą.
      </p>
    </BenefivoModal>
  );
};
