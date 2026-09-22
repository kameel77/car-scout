import React from 'react';

export interface StepsSectionProps {
  onOpenEmployeeDialog: () => void;
}

export const StepsSection: React.FC<StepsSectionProps> = ({ onOpenEmployeeDialog }) => {
  return (
    <section id="jak-to-dziala" className="section wrap steps-section" aria-labelledby="steps-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PROSTY KIERUNEK</p>
          <h2 id="steps-title">Z pracy. W drogę.</h2>
        </div>
        <button
          className="button button-outline"
          type="button"
          onClick={onOpenEmployeeDialog}
        >
          Jak mogę dołączyć? <span aria-hidden="true">&rarr;</span>
        </button>
      </div>

      <ol className="steps">
        <li>
          <span className="step-number">01</span>
          <h3>Sprawdź dostęp w swojej firmie</h3>
          <p>
            Masz kod? Aktywuj konto. Jeśli Twoja firma nie korzysta jeszcze z Benefivo, wyślij gotową propozycję do HR.
          </p>
        </li>
        <li>
          <span className="step-number">02</span>
          <h3>Znajdź ofertę dla siebie</h3>
          <p>
            Porównaj samochody, formy finansowania i warunki dostępne w programie Twojej firmy.
          </p>
        </li>
        <li>
          <span className="step-number">03</span>
          <h3>Wybierz i ruszaj</h3>
          <p>
            Poznaj pełne warunki, złóż wniosek i podpisz umowę, jeśli oferta Ci odpowiada.
          </p>
        </li>
      </ol>
    </section>
  );
};
