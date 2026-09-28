import React, { useRef, useState } from 'react';
import { useTrack } from '../../analytics/useTrack';
import { PILOT_LINE } from '../content/marketing';

export interface CostCounterProps {
  onCta: () => void;
}

/** Employer page: team-size slider next to a cost figure that stays at 0 zł. */
export const CostCounter: React.FC<CostCounterProps> = ({ onCta }) => {
  const track = useTrack();
  const [team, setTeam] = useState(250);
  const [bump, setBump] = useState<'a' | 'b' | null>(null);
  const lastBump = useRef(0);
  const tracked = useRef(false);
  const teamText = team.toLocaleString('pl-PL');

  const onChange = (value: number) => {
    setTeam(value);
    const now = Date.now();
    if (now - lastBump.current > 150) {
      lastBump.current = now;
      setBump((b) => (b === 'a' ? 'b' : 'a'));
    }
    if (!tracked.current) {
      tracked.current = true;
      track('b2b_cost_slider_used');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mb-10">
      <div className="flex flex-col gap-5">
        <h3 className="font-heading !text-3xl sm:!text-4xl font-bold tracking-tight">
          Ile kosztuje benefit samochodowy dla Twojego zespołu?
        </h3>
        <label htmlFor="team-size-range" className="font-semibold">
          Przesuń i sprawdź: {teamText} osób w zespole
        </label>
        <input
          id="team-size-range"
          type="range"
          min={10}
          max={2000}
          step={10}
          value={team}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bf-range"
        />
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className="button button-dark" onClick={onCta}>
            Umów 20 minut <span aria-hidden="true">&rarr;</span>
          </button>
          <span className="text-sm text-muted">{PILOT_LINE}</span>
        </div>
      </div>
      <div className="bg-forest text-paper rounded-[36px] p-8 sm:p-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-[#C9D3C4]">Koszt dla firmy</span>
          <span
            className={`font-heading text-7xl sm:text-8xl font-extrabold tracking-tighter text-lime leading-none inline-block ${bump ? `bf-bump-${bump}` : ''}`}
          >
            0 zł
          </span>
          <span className="text-sm text-[#C9D3C4]">bez względu na to, czy to 10, czy {teamText} osób</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Wdrożenie', '0 zł'],
            ['Co miesiąc', '0 zł'],
            ['Praca HR', '1 mail'],
          ].map(([label, value]) => (
            <div key={label} className="bg-ink rounded-2xl p-4 flex flex-col gap-1">
              <span className="text-xs text-[#C9D3C4]">{label}</span>
              <span className="font-heading text-xl font-bold">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-muted pt-4">
          <span className="text-sm text-[#C9D3C4]">Dostęp do programu dostaje</span>
          <span className="font-heading text-2xl font-bold tabular-nums">{teamText} osób</span>
        </div>
      </div>
    </div>
  );
};
