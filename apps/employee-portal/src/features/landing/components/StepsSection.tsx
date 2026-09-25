import React from 'react';

export interface StepsSectionProps {
  onOpenEmployeeDialog: () => void;
}

export const StepsSection: React.FC<StepsSectionProps> = ({ onOpenEmployeeDialog }) => {
  return (
    <section id="jak-to-dziala" className="section wrap steps-section" aria-labelledby="steps-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">JAK TO DZIAŁA</p>
          <h2 id="steps-title">Trzy kroki do nowego auta</h2>
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
          <h3>Aktywuj dostęp</h3>
          <p>
            Załóż konto z kodem firmy. Nie masz kodu? Wyślij gotową wiadomość do HR.
          </p>
        </li>
        <li>
          <span className="step-number">02</span>
          <h3>Wybierz auto</h3>
          <p>
            Porównaj oferty i policz ratę brutto w kalkulatorze.
          </p>
        </li>
        <li>
          <span className="step-number">03</span>
          <h3>Porozmawiaj z doradcą</h3>
          <p>
            Zapytanie jest bezpłatne i niezobowiązujące. Doradca oddzwoni w 24 godziny.
          </p>
        </li>
      </ol>
    </section>
  );
};
