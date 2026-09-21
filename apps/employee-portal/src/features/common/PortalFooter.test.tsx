import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PortalFooter } from './PortalFooter';

describe('PortalFooter Component', () => {
  it('renders copyright, Powered by motolia. link, and legal links', () => {
    render(
      <MemoryRouter>
        <PortalFooter />
      </MemoryRouter>
    );

    expect(screen.getByText(/Benefivo\. Wszelkie prawa zastrzeżone\./i)).toBeInTheDocument();
    expect(screen.getByText(/Powered by/i)).toBeInTheDocument();
    const motoliaLink = screen.getByRole('link', { name: /motolia\./i });
    expect(motoliaLink).toHaveAttribute('href', 'https://motolia.pl/');

    expect(screen.getByRole('link', { name: /Regulamin/i })).toHaveAttribute('href', '/regulamin');
    expect(screen.getByRole('link', { name: /Polityka prywatności/i })).toHaveAttribute('href', '/prywatnosc');
  });
});
