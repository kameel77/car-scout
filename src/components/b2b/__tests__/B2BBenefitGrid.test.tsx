import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { B2BBenefitGrid } from '../B2BBenefitGrid';

describe('B2BBenefitGrid', () => {
  it('renders 3 benefit cards with expected titles', () => {
    render(<B2BBenefitGrid />);
    expect(screen.getByText('Wybór pojazdu')).toBeInTheDocument();
    expect(screen.getByText('Finansowanie kredyt i leasing')).toBeInTheDocument();
    expect(screen.getByText(/Szkoda całkowita/)).toBeInTheDocument();
  });

  it('mentions Link4 partnership in szkoda card', () => {
    render(<B2BBenefitGrid />);
    expect(screen.getAllByText(/Link4/i).length).toBeGreaterThan(0);
  });
});
