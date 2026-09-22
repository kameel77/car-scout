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
          <h3>Zacznij w swojej firmie</h3>
          <p>
            Zapytaj HR o dostęp do programu Benefivo lub poleć nam swojego pracodawcę.
          </p>
        </li>
        <li>
          <span className="step-number">02</span>
          <h3>Znajdź swój samochód</h3>
          <p>
            Dobierz auto, finansowanie i usługi w katalogu. Poznaj wszystkie warunki przed podjęciem decyzji.
          </p>
        </li>
        <li>
          <span className="step-number">03</span>
          <h3>Odbierz kluczyki</h3>
          <p>
            Po akceptacji wniosku i podpisaniu umowy czas na Twoją pierwszą podróż.
          </p>
        </li>
      </ol>
    </section>
  );
};
