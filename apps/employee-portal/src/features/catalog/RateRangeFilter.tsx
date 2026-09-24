import React from 'react';
import { resetViewportScale } from '../../utils/viewport';

export interface RateRangeFilterProps {
  minRate: number | '';
  maxRate: number | '';
  onChange: (min: number | '', max: number | '') => void;
  label?: string;
  onBlur?: () => void;
}

interface Preset {
  label: string;
  min: number | '';
  max: number | '';
}

const PRESETS: Preset[] = [
  { label: '< 1500', min: '', max: 1500 },
  { label: '1500 - 2500', min: 1500, max: 2500 },
  { label: '2500 - 3500', min: 2500, max: 3500 },
  { label: '3500+', min: 3500, max: '' },
];

export const RateRangeFilter: React.FC<RateRangeFilterProps> = ({
  minRate,
  maxRate,
  onChange,
  label = 'Rata miesięczna (zł brutto)',
  onBlur
}) => {
  const isPresetActive = (p: Preset) => {
    const pMin = p.min === '' ? '' : p.min;
    const pMax = p.max === '' ? '' : p.max;
    const currentMin = minRate === '' ? '' : Number(minRate);
    const currentMax = maxRate === '' ? '' : Number(maxRate);
    return currentMin === pMin && currentMax === pMax;
  };

  const handleBlur = () => {
    resetViewportScale();
    onBlur?.();
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange('', maxRate);
    } else {
      const num = Number(val);
      if (!isNaN(num) && num >= 0) {
        onChange(num, maxRate);
      }
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange(minRate, '');
    } else {
      const num = Number(val);
      if (!isNaN(num) && num >= 0) {
        onChange(minRate, num);
      }
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-2xs font-semibold text-muted uppercase tracking-wider">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            step={100}
            value={minRate}
            onChange={handleMinChange}
            onBlur={handleBlur}
            placeholder="od"
            aria-label="Minimalna rata"
            className="w-full text-base sm:text-xs py-2 px-2.5 bg-paper border border-line rounded-xl text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </div>
        <span className="text-muted text-xs font-semibold">-</span>
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            step={100}
            value={maxRate}
            onChange={handleMaxChange}
            onBlur={handleBlur}
            placeholder="do"
            aria-label="Maksymalna rata"
            className="w-full text-base sm:text-xs py-2 px-2.5 bg-paper border border-line rounded-xl text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {PRESETS.map((p) => {
          const active = isPresetActive(p);
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                if (active) {
                  onChange('', '');
                } else {
                  onChange(p.min, p.max);
                }
              }}
              className={`text-2xs font-semibold px-2.5 py-1 rounded-full transition-colors border ${
                active
                  ? 'bg-lime text-ink border-line shadow-xs'
                  : 'bg-paper text-muted border-line hover:text-ink hover:bg-white'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
