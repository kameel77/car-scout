import React from 'react';
import { trackEvent } from '../../analytics/analytics';
import { useBrandConfig } from '../../../config/BrandContext';

export const FaqSection: React.FC = () => {
  const { config } = useBrandConfig();

  const handleToggle = (question: string, open: boolean) => {
    if (open) {
      trackEvent('faq_toggle', { question }, config.apiUrl, config.analyticsEnabled);
    }
  };

  return (
    <section className="section wrap faq-section" aria-labelledby="faq-title">
      <div>
        <p className="eyebrow">DOBRZE WIEDZIEĆ</p>
        <h2 id="faq-title">
          Jeszcze tylko<br />
          kilka pytań.
        </h2>
      </div>

      <div className="faq-list">
        <details onToggle={(e) => handleToggle('Czym jest Benefivo?', e.currentTarget.open)}>
          <summary>
            Czym jest Benefivo?
            <span aria-hidden="true">+</span>
          </summary>
          <p>
            To nowoczesny program benefitów motoryzacyjnych dla pracowników: najem i leasing samochodów oraz dodatkowe korzyści (paliwo, serwis, opony, myjnie). Operatorem platformy i partnerem flotowym programu jest Motolia Sp. z o.o.
          </p>
        </details>

        <details onToggle={(e) => handleToggle('Czy pracodawca płaci za mój samochód?', e.currentTarget.open)}>
          <summary>
            Czy pracodawca płaci za mój samochód?
            <span aria-hidden="true">+</span>
          </summary>
          <p>
            Nie musi. Podstawowym benefitem jest sam dostęp pracownika do wynegocjowanych, preferencyjnych stawek korporacyjnych. Ewentualna dopłata firmy do raty zależy od ustaleń z działem HR Twojej firmy.
          </p>
        </details>

        <details onToggle={(e) => handleToggle('Czy mogę używać auta prywatnie?', e.currentTarget.open)}>
          <summary>
            Czy mogę używać auta prywatnie?
            <span aria-hidden="true">+</span>
          </summary>
          <p>
            Tak. Program jest stworzony z myślą o Twoim codziennym życiu, weekendach i rodzinnych wyjazdach. Szczegółowy zakres użytkowania oraz roczny limit kilometrów ustalasz indywidualnie przy konfiguracji oferty.
          </p>
        </details>

        <details onToggle={(e) => handleToggle('Co, jeśli moja firma nie ma jeszcze Benefivo?', e.currentTarget.open)}>
          <summary>
            Co, jeśli moja firma nie ma jeszcze Benefivo?
            <span aria-hidden="true">+</span>
          </summary>
          <p>
            Skorzystaj z przycisku „Chcę skorzystać”, aby skopiować gotową propozycję wiadomości do swojego działu HR. Możesz też polecić program osobom odpowiedzialnym za benefity w Twojej organizacji.
          </p>
        </details>
      </div>
    </section>
  );
};
