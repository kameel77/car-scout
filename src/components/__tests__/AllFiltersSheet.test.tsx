import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AllFiltersSheet, AllFiltersSheetHandle } from '../AllFiltersSheet';

vi.mock('@/components/FilterPanel', () => ({
  FilterPanel: () => <div data-testid="filter-panel">panel</div>,
}));

describe('AllFiltersSheet', () => {
  afterEach(cleanup);

  it('shows the sheet frame on open() and mounts the FilterPanel afterwards', async () => {
    const ref = React.createRef<AllFiltersSheetHandle>();
    render(
      <MemoryRouter>
        <AllFiltersSheet
          ref={ref}
          filters={{} as any}
          onFilterChange={() => {}}
          onClear={() => {}}
          resultCount={0}
          availableMakes={[]}
          availableModels={[]}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('filter-panel')).toBeNull();

    act(() => ref.current!.open());

    expect(screen.getByText('filters.title')).toBeInTheDocument();
    expect(await screen.findByTestId('filter-panel')).toBeInTheDocument();
  });
});
