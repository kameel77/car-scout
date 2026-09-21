import React from 'react';
import { BenefivoModal } from './BenefivoModal';

export interface RentalDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEmployee: () => void;
}

export const RentalDetailsDialog: React.FC<RentalDetailsDialogProps> = ({
  isOpen,
  onClose,
  onOpenEmployee,
}) => {
  return (
    <BenefivoModal
      isOpen={isOpen}
      onClose={onClose}
      kicker="NAJEM DŁUGOTERMINOWY"
      title="Auto na Twoją codzienność."
      description="Wybierasz samochód, okres użytkowania i roczny limit kilometrów. Pełen zakres usług serwisowych i ubezpieczeń poznajesz przed podjęciem decyzji."
    >
      <ul>
        <li>Użytkowanie fabrycznie nowego samochodu przez ustalony czas (np. 24, 36 lub 48 miesięcy).</li>
        <li>Możliwość włączenia w jedną stałą ratę: pełnego serwisu mechanicznego, ubezpieczenia OC/AC/NNW oraz sezonowej wymiany opon.</li>
        <li>Przejrzyste zasady rozliczenia przebiegu i zwrotu pojazdu na koniec umowy.</li>
        <li>Brak ryzyka utraty wartości rynkowej samochodu przy odsprzedaży.</li>
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
        Dostępność modeli oraz konkretne stawki rat wynikają z oferty programu przygotowanej dla danej firmy.
      </p>
    </BenefivoModal>
  );
};
