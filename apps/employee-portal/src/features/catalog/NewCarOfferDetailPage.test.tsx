import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NewCarOfferDetailPage } from './NewCarOfferDetailPage';
import { BrandProvider } from '../../config/BrandContext';
import { AuthProvider } from '../auth/AuthContext';
import * as catalogApi from './catalog-api';
import * as authApi from '../auth/auth-api';

const mockAuthenticatedEmployee: authApi.EmployeeUser = {
  id: 'acc_123',
  email: 'jan.kowalski@finarena.pl',
  firstName: 'Jan',
  lastName: 'Kowalski',
  phone: '+48 500 600 700',
  company: {
    id: 'c1',
    name: 'Finarena Sp. z o.o.',
    slug: 'finarena',
  },
  program: {
    id: 'p1',
    name: 'Program Samochodowy Finarena',
    slug: 'glowny',
  },
};

const mockOffer: catalogApi.EmployeeOffer = {
  id: 'offer-new-1',
  sourceType: 'LISTING',
  vehicle: {
    id: 'veh-1',
    make: 'Toyota',
    model: 'Corolla',
    version: '1.8 Hybrid Comfort Tech',
    productionYear: 2025,
    fuelType: 'HYBRID',
    transmission: 'AUTOMATIC',
    bodyType: 'Kombi',
    primaryImageUrl: 'https://example.com/corolla.jpg',
    imageUrls: ['https://example.com/corolla.jpg', 'https://example.com/corolla-back.jpg'],
    powerHp: 140,
    engineCapacityCm3: 1798,
    doors: 5,
    seats: 5,
    color: 'Srebrny metalik',
    paintType: 'METALLIC',
    drive: 'FWD',
    equipmentSafety: ['System PCS', 'Tempomat adaptacyjny ACC'],
    equipmentComfortExtras: ['Klimatyzacja dwustrefowa', 'Podgrzewane fotele przednie'],
    equipmentAudioMultimedia: ['Apple CarPlay / Android Auto', 'Ekran 10.5"'],
    equipmentOther: ['Felgi aluminiowe 17"'],
    additionalInfoHeader: 'Dodatkowe informacje o pojeździe',
    additionalInfoContent: 'Samochód fabrycznie nowy, dostępny od ręki.'
  },
  pricing: {
    listPricePln: 140000,
    employeePricePln: 126000,
    savingsPln: 14000,
    discountPct: 10
  },
  benefit: {
    name: 'Pakiet Benefit Moya & Flota',
    moyaCardAmount: 500,
    fuelDiscount: '15 gr/l',
    consultantCare: true,
    termsText: null
  }
};

describe('NewCarOfferDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(catalogApi, 'fetchEmployeeOfferDetails').mockResolvedValue(mockOffer);
  });

  const renderComponent = (offerId = 'offer-new-1') => {
    return render(
      <BrandProvider initialConfig={{ brandName: 'Motolia', brandLogoUrl: '/logo.svg', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <MemoryRouter initialEntries={[`/katalog/${offerId}`]}>
            <Routes>
              <Route path="/katalog/:id" element={<NewCarOfferDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );
  };

  it('renders vehicle details, specs, and benefits correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('Toyota Corolla').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('1.8 Hybrid Comfort Tech')).toBeInTheDocument();
    });

    // Pricing
    expect(screen.getByText(/126\s?000\s?zł/)).toBeInTheDocument();
    expect(screen.getByText(/Oszczędzasz 14\s?000\s?zł/)).toBeInTheDocument();

    // Specs
    expect(screen.getByText('Hybryda')).toBeInTheDocument();
    expect(screen.getByText('Automatyczna')).toBeInTheDocument();
    expect(screen.getByText('140 KM')).toBeInTheDocument();
    expect(screen.getByText(/1\s?798\s?cm³/)).toBeInTheDocument();

    // Equipment
    expect(screen.getByText('System PCS')).toBeInTheDocument();
    expect(screen.getByText('Klimatyzacja dwustrefowa')).toBeInTheDocument();
    expect(screen.getByText('Apple CarPlay / Android Auto')).toBeInTheDocument();

    // Benefit
    expect(screen.getByText('Pakiet Benefit Moya & Flota')).toBeInTheDocument();
    expect(screen.getByText(/Karta paliwowa Moya/)).toBeInTheDocument();
  });

  it('renders financing calculator and updates calculations on parameter selection', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Kalkulator finansowania')).toBeInTheDocument();
    });

    // Check months buttons
    const month48Btn = screen.getByRole('button', { name: '48 msc' });
    expect(month48Btn).toBeInTheDocument();
    fireEvent.click(month48Btn);

    // Check down payment 30% (first 30% button in DOM)
    const dp30Btns = screen.getAllByRole('button', { name: '30%' });
    expect(dp30Btns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(dp30Btns[0]);

    // Check residual 10% (second 10% button in DOM)
    const tenPctBtns = screen.getAllByRole('button', { name: '10%' });
    expect(tenPctBtns.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(tenPctBtns[1]);

    // Rate heading is displayed
    expect(screen.getByText('Szacowana rata miesięczna')).toBeInTheDocument();
    expect(screen.getByText(/brutto \/ mies\./)).toBeInTheDocument();
    expect(screen.getByText(/netto \/ mies\./)).toBeInTheDocument();
  });

  it('defaults to consumer financing with gross rate as primary figure, and inverts on B2B toggle', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Kalkulator finansowania')).toBeInTheDocument();
    });

    const consumerBtn = screen.getByRole('button', { name: 'Prywatnie' });
    const b2bBtn = screen.getByRole('button', { name: 'Rozliczam B2B' });
    expect(consumerBtn).toBeInTheDocument();
    expect(b2bBtn).toBeInTheDocument();

    // In consumer mode, the large font heading is gross rate
    const grossSuffix = screen.getByText(/brutto \/ mies\./);
    expect(grossSuffix.previousElementSibling?.className).toContain('text-3xl');

    // Toggle to B2B
    fireEvent.click(b2bBtn);

    // In B2B mode, the large font heading is net rate
    const netSuffix = screen.getByText(/netto \/ mies\./);
    expect(netSuffix.previousElementSibling?.className).toContain('text-3xl');
  });

  it('opens inquiry modal with calculated financing notes when clicking CTA', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('Toyota Corolla').length).toBeGreaterThanOrEqual(1);
    });

    const ctaButton = screen.getByRole('button', { name: /Zapytaj o tę ofertę i ratę/i });
    expect(ctaButton).toBeInTheDocument();
    fireEvent.click(ctaButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Zapytaj o tę ofertę/i })).toBeInTheDocument();
    });

    // The notes textarea should contain the financing summary
    const notesTextarea = screen.getByLabelText(/Uwagi lub pytania/i);
    expect(notesTextarea).toBeInTheDocument();
    expect((notesTextarea as HTMLTextAreaElement).value).toContain('Konfiguracja kalkulatora finansowania');
  });

  it('displays error message when offer fails to load', async () => {
    vi.spyOn(catalogApi, 'fetchEmployeeOfferDetails').mockRejectedValueOnce(new Error('Nie znaleziono oferty'));

    renderComponent('non-existent-id');

    await waitFor(() => {
      expect(screen.getByText('Nie udało się załadować oferty')).toBeInTheDocument();
      expect(screen.getByText('Nie znaleziono oferty')).toBeInTheDocument();
    });
  });
});

describe('NewCarOfferDetailPage — E2 financing config (brief-e2-product-overrides.md)', () => {
  const mockOfferWithFinancing: catalogApi.EmployeeOffer = {
    ...mockOffer,
    financing: {
      options: [
        {
          productId: 'fp_credit_1',
          category: 'CREDIT',
          label: 'Kredyt Elastyczny',
          allowedContractParties: ['CONSUMER'],
          b2cStatus: 'AVAILABLE',
          minDownPaymentPct: 10,
          maxDownPaymentPct: 30,
          maxResidualPct: 0,
          periods: [24, 36],
          annualRatePct: 9.99
        }
      ]
    }
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
  });

  const renderComponent = (offerId = 'offer-new-1') => {
    return render(
      <BrandProvider initialConfig={{ brandName: 'Motolia', brandLogoUrl: '/logo.svg', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <MemoryRouter initialEntries={[`/katalog/${offerId}`]}>
            <Routes>
              <Route path="/katalog/:id" element={<NewCarOfferDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );
  };

  it('renders only the periods and down payments allowed by the financing config, hides the residual section when maxResidualPct is 0, and computes the rate from annualRatePct', async () => {
    vi.spyOn(catalogApi, 'fetchEmployeeOfferDetails').mockResolvedValue(mockOfferWithFinancing);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Kalkulator finansowania')).toBeInTheDocument();
    });

    // Only the configured periods (24, 36) render — the legacy 48/60 buttons are gone.
    expect(screen.getByRole('button', { name: '24 msc' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '36 msc' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '48 msc' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '60 msc' })).not.toBeInTheDocument();

    // Down payment chips are clipped to [10, 30] — 0% and 45% presets are dropped.
    expect(screen.getByRole('button', { name: '10%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30%' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '0%' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '45%' })).not.toBeInTheDocument();

    // maxResidualPct === 0 -> the buyout section is hidden entirely.
    expect(screen.queryByText('Wykup końcowy')).not.toBeInTheDocument();

    // Single CREDIT option renders with the category-derived label.
    expect(screen.getByRole('button', { name: 'Prywatnie' })).toBeInTheDocument();

    expect(screen.getByText('Szacowana rata miesięczna')).toBeInTheDocument();
  });

  it('includes the selected financing product label in the inquiry notes', async () => {
    vi.spyOn(catalogApi, 'fetchEmployeeOfferDetails').mockResolvedValue(mockOfferWithFinancing);

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('Toyota Corolla').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /Zapytaj o tę ofertę i ratę/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const notesTextarea = screen.getByLabelText(/Uwagi lub pytania/i) as HTMLTextAreaElement;
    expect(notesTextarea.value).toContain('Wybrany produkt finansowania: Kredyt Elastyczny');
  });

  it('behaves exactly as before E2 when financing is null (no overrides configured for the program)', async () => {
    vi.spyOn(catalogApi, 'fetchEmployeeOfferDetails').mockResolvedValue({ ...mockOffer, financing: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Kalkulator finansowania')).toBeInTheDocument();
    });

    // Legacy fixed options are still present.
    expect(screen.getByRole('button', { name: '24 msc' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '48 msc' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '60 msc' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '0%' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Wykup końcowy')).toBeInTheDocument();
  });
});
