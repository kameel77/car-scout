import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useListingOptions } from '@/hooks/useListingOptions';
import { rentalPublicApi } from '@/services/rental-api';
import './HeroVehicleFilter.css';

// ─── Types ──────────────────────────────────────────────────────────────────

type ClientType = 'private' | 'business';
type VehicleStatus = 'new' | 'used' | 'rental';

interface FilterState {
  clientType: ClientType;
  status: VehicleStatus;
  bodyType: string;
  make: string;
  model: string;
  priceMin: string;
  priceMax: string;
}

interface OptionsData {
  makes: string[];
  models: { make: string; model: string }[];
  bodyTypes: string[];
}

// ─── Custom Dropdown ────────────────────────────────────────────────────────

interface DropdownProps {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  disabled?: boolean;
  searchable?: boolean;
}

function Dropdown({ label, placeholder, value, options, onChange, disabled, searchable }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, search]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setOpen(prev => !prev);
    setSearch('');
  }, [disabled]);

  const handleSelect = useCallback((val: string) => {
    onChange(value === val ? '' : val);
    setOpen(false);
    setSearch('');
  }, [value, onChange]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open, searchable]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="hvf__field" ref={ref}>
      {label && <span className="hvf__label">{label}</span>}
      <button
        type="button"
        className={`hvf__field-trigger ${open ? 'hvf__field-trigger--open' : ''} ${disabled ? 'hvf__field-trigger--disabled' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
      >
        {value ? (
          <span>{value}</span>
        ) : (
          <span className="hvf__field-placeholder">{placeholder}</span>
        )}
        <ChevronDown className="hvf__field-chevron" />
      </button>

      {open && (
        <div className="hvf__dropdown">
          {searchable && (
            <div className="hvf__dropdown-search">
              <input
                ref={searchRef}
                type="text"
                placeholder="Szukaj..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="hvf__dropdown-empty">Brak wyników</div>
          ) : (
            filtered.map(opt => (
              <button
                key={opt}
                type="button"
                className={`hvf__dropdown-item ${value === opt ? 'hvf__dropdown-item--selected' : ''}`}
                onClick={() => handleSelect(opt)}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Hook: fetch rental filter options (public endpoint) ────────────────────

function useRentalFilterOptions() {
  return useQuery<OptionsData>({
    queryKey: ['rentalFilterOptions'],
    queryFn: async () => {
      const data = await rentalPublicApi.listVehicles({ limit: '1' });
      const filters = data.filters || {};
      return {
        makes: (filters.makes || []).sort() as string[],
        bodyTypes: (filters.bodyTypes || []).sort() as string[],
        // Rental doesn't have per-make models from the filter options endpoint,
        // so we return an empty array. The user will search by make only.
        models: [] as { make: string; model: string }[],
      };
    },
    staleTime: 1000 * 60 * 30, // 30 min
    refetchOnWindowFocus: false,
  });
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function HeroVehicleFilter() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState<FilterState>({
    clientType: 'private',
    status: 'new',
    bodyType: '',
    make: '',
    model: '',
    priceMin: '',
    priceMax: '',
  });

  // Fetch options for both contexts
  const { data: listingOptions, isLoading: listingLoading } = useListingOptions();
  const { data: rentalOptions, isLoading: rentalLoading } = useRentalFilterOptions();

  // Pick the right options based on current status
  const isRental = filters.status === 'rental';
  const activeOptions = isRental ? rentalOptions : listingOptions;
  const isLoading = isRental ? rentalLoading : listingLoading;

  const makes = activeOptions?.makes ?? [];
  const bodyTypes = activeOptions?.bodyTypes ?? [];

  // Derived: models filtered by selected make
  const availableModels = useMemo(() => {
    if (!activeOptions?.models || !filters.make) return [];
    return activeOptions.models
      .filter(m => m.make.toLowerCase() === filters.make.toLowerCase())
      .map(m => m.model)
      .sort();
  }, [activeOptions?.models, filters.make]);

  // Reset dependent fields when status changes
  const handleStatusChange = useCallback((status: VehicleStatus) => {
    setFilters(prev => ({
      ...prev,
      status,
      bodyType: '',
      make: '',
      model: '',
    }));
  }, []);

  // Reset model when make changes
  const handleMakeChange = useCallback((make: string) => {
    setFilters(prev => ({ ...prev, make, model: '' }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (filters.status === 'rental') {
      // Navigate to rental search
      const params = new URLSearchParams();
      if (filters.bodyType) params.set('bodyType', filters.bodyType);
      if (filters.make) params.set('make', filters.make);
      if (filters.clientType === 'business') params.set('offerType', 'b2b');
      const qs = params.toString();
      navigate(`/wynajem-dlugoterminowy${qs ? `?${qs}` : ''}`);
    } else {
      // Navigate to listings search
      const params = new URLSearchParams();
      if (filters.clientType === 'business') params.set('clientType', 'business');
      if (filters.status) params.set('status', filters.status);
      if (filters.bodyType) params.set('bodyType', filters.bodyType);
      if (filters.make) params.set('make', filters.make);
      if (filters.model) params.set('model', filters.model);
      if (filters.priceMin) params.set('priceMin', filters.priceMin);
      if (filters.priceMax) params.set('priceMax', filters.priceMax);
      const qs = params.toString();
      navigate(`/samochody${qs ? `?${qs}` : ''}`);
    }
  }, [filters, navigate]);

  const handleAdvancedSearch = useCallback(() => {
    navigate('/samochody?openFilters=true');
  }, [navigate]);

  return (
    <div className="hvf">
      {/* Header */}
      <div className="hvf__header">
        <h2 className="hvf__title">
          Znajdź auto {!isLoading && makes.length > 0 && (
            <span>z <strong>{makes.length}+</strong> marek</span>
          )}
        </h2>
      </div>

      {/* Client type toggle */}
      <div className="hvf__toggle-group">
        <button
          type="button"
          className={`hvf__toggle-btn ${filters.clientType === 'private' ? 'hvf__toggle-btn--active' : ''}`}
          onClick={() => setFilters(prev => ({ ...prev, clientType: 'private' }))}
        >
          Prywatnie
        </button>
        <button
          type="button"
          className={`hvf__toggle-btn ${filters.clientType === 'business' ? 'hvf__toggle-btn--active' : ''}`}
          onClick={() => setFilters(prev => ({ ...prev, clientType: 'business' }))}
        >
          Na firmę
        </button>
      </div>

      {/* Status toggle */}
      <div className="hvf__toggle-group">
        <button
          type="button"
          className={`hvf__toggle-btn ${filters.status === 'new' ? 'hvf__toggle-btn--accent' : ''}`}
          onClick={() => handleStatusChange('new')}
        >
          Nowy
        </button>
        <button
          type="button"
          className={`hvf__toggle-btn ${filters.status === 'used' ? 'hvf__toggle-btn--accent' : ''}`}
          onClick={() => handleStatusChange('used')}
        >
          Używany
        </button>
        <button
          type="button"
          className={`hvf__toggle-btn ${filters.status === 'rental' ? 'hvf__toggle-btn--accent' : ''}`}
          onClick={() => handleStatusChange('rental')}
        >
          Wynajem
        </button>
      </div>

      {/* Body type */}
      <Dropdown
        label="Nadwozie"
        placeholder="Wybierz nadwozie"
        value={filters.bodyType}
        options={bodyTypes}
        onChange={val => setFilters(prev => ({ ...prev, bodyType: val }))}
      />

      {/* Make (searchable) */}
      <Dropdown
        label="Marka"
        placeholder="Wszystkie marki"
        value={filters.make}
        options={makes}
        onChange={handleMakeChange}
        searchable
      />

      {/* Model (cascading, disabled if no make or rental mode) */}
      <Dropdown
        label="Model"
        placeholder={
          isRental
            ? 'Niedostępne w wynajmie'
            : filters.make
              ? 'Wybierz model'
              : 'Najpierw wybierz markę'
        }
        value={filters.model}
        options={availableModels}
        onChange={val => setFilters(prev => ({ ...prev, model: val }))}
        disabled={!filters.make || isRental}
      />

      {/* Price range */}
      <span className="hvf__label">Cena (PLN)</span>
      <div className="hvf__range-row">
        <input
          type="number"
          className="hvf__range-input"
          placeholder="Od"
          value={filters.priceMin}
          onChange={e => setFilters(prev => ({ ...prev, priceMin: e.target.value }))}
          min={0}
        />
        <input
          type="number"
          className="hvf__range-input"
          placeholder="Do"
          value={filters.priceMax}
          onChange={e => setFilters(prev => ({ ...prev, priceMax: e.target.value }))}
          min={0}
        />
      </div>

      {/* Footer */}
      <div className="hvf__footer">
        <a
          href="/samochody?openFilters=true"
          className="hvf__advanced-link"
          onClick={e => {
            e.preventDefault();
            handleAdvancedSearch();
          }}
        >
          <SlidersHorizontal size={13} />
          Wyszukiwanie zaawansowane
        </a>
        <button
          type="button"
          className="hvf__submit-btn"
          onClick={handleSubmit}
        >
          <Search size={16} />
          Pokaż oferty
        </button>
      </div>
    </div>
  );
}
