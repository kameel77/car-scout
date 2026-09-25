import React from 'react';
import { useTrack } from '../../analytics/useTrack';
import type { FaqItem } from '../content/marketing';

const EMPLOYEE_FAQ: FaqItem[] = [
  {
    question: 'Czym jest Benefivo?',
    answer: 'To program samochodowy dla pracowników firm partnerskich: najem i finansowanie nowych aut z rabatem od ceny katalogowej, karta Moya i opieka doradcy. Operatorem platformy jest Motolia Sp. z o.o.',
    approved: true,
  },
  {
    question: 'Czy pracodawca płaci za mój samochód?',
    answer: 'Nie musi. Podstawowym benefitem jest dostęp do warunków programu i opieki doradcy. Ewentualna dopłata firmy do raty zależy od ustaleń z działem HR Twojej firmy.',
    approved: true,
  },
  {
    question: 'Czy mogę używać auta prywatnie?',
    answer: 'Tak. Program jest stworzony z myślą o Twoim codziennym życiu, weekendach i rodzinnych wyjazdach. Szczegółowy zakres użytkowania oraz roczny limit kilometrów ustalasz indywidualnie przy konfiguracji oferty.',
    approved: true,
  },
  {
    question: 'Co, jeśli moja firma nie ma jeszcze Benefivo?',
    answer: 'Kliknij „Moja firma nie ma Benefivo” na górze strony. Przygotowaliśmy krótką wiadomość, którą możesz przesłać osobie odpowiedzialnej za benefity.',
    approved: true,
  },
  {
    question: 'Czy muszę mieć zdolność kredytową?',
    answer: 'Tak. Najem i finansowanie wymagają pozytywnej oceny instytucji finansującej. Doradca pomoże dobrać ofertę do Twojej sytuacji.',
    approved: true,
  },
  { question: 'Czy moja firma zobaczy moje dane i ratę?', answer: 'TODO', approved: false },
  { question: 'Co, jeśli zmienię pracę?', answer: 'TODO', approved: false },
  { question: 'Ile czeka się na auto?', answer: 'TODO', approved: false },
];

export const FaqSection: React.FC = () => {
  const track = useTrack();

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
        {EMPLOYEE_FAQ.filter((item) => item.approved).map((item) => (
          <details
            key={item.question}
            onToggle={(e) => {
              if (e.currentTarget.open) track('faq_toggle', { question: item.question });
            }}
          >
            <summary>
              {item.question}
              <span aria-hidden="true">+</span>
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
};
