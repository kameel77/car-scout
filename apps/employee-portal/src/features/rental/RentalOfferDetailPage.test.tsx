import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RentalOfferDetailPage } from './RentalOfferDetailPage';
import { AuthProvider } from '../auth/AuthContext';
import { BrandProvider } from '../../config/BrandContext';
import * as authApi from '../auth/auth-api';
import * as rentalApi from './rental-api';
import * as inquiriesApi from '../inquiries/inquiries-api';

const mockConfig = {
  brandName: 'Finarena Auto Program',
  brandLogoUrl: '/logo.svg',
  portalUrl: '',
  apiUrl: '/api',
};

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

const mockRentalOfferDetails: rentalApi.EmployeeRentalOfferDetails = {
  id: 'rental-offer-1',
  sourceType: 'RENTAL',
  vehicle: {
    id: 'veh-1',
    make: 'Toyota',
    model: 'Corolla',
    version: '1.8 Hybrid Comfort',
    productionYear: 2026,
    fuelType: 'HYBRID',
    transmission: 'AUTOMATIC',
    bodyType: 'KOMBI',
    primaryImageUrl: 'https://images.motolia.pl/corolla.jpg',
    imageUrls: ['https://images.motolia.pl/corolla.jpg', 'https://images.motolia.pl/corolla-interior.jpg'],
  },
  rentalCompany: {
    id: 'comp-1',
    name: 'Arval',
    logoUrl: null,
  },
  rateSource: 'PARTNER_MATRIX',
  contractMonthsOptions: [24, 36, 48],
  annualMileageOptions: [10000, 20000, 30000],
  downPaymentPctOptions: [0, 5, 10],
  rentalOptions: [
    {
      assignmentId: 'comp-1',
      contractMonths: 24,
      annualMileage: 10000,
      downPaymentPct: 0,
      downPaymentAmountPln: 0,
      monthlyRateNet: 1650,
      monthlyRateGross: 2029.5,
      rateSource: 'PARTNER_MATRIX',
    },
    {
      assignmentId: 'comp-1',
      contractMonths: 36,
      annualMileage: 20000,
      downPaymentPct: 0,
      downPaymentAmountPln: 0,
      monthlyRateNet: 1450,
      monthlyRateGross: 1783.5,
      rateSource: 'PARTNER_MATRIX',
    },
    {
      assignmentId: 'comp-1',
      contractMonths: 36,
      annualMileage: 20000,
      downPaymentPct: 10,
      downPaymentAmountPln: 11000,
      monthlyRateNet: 1150,
      monthlyRateGross: 1414.5,
      rateSource: 'PARTNER_MATRIX',
    },
    {
      assignmentId: 'comp-1',
      contractMonths: 48,
      annualMileage: 30000,
      downPaymentPct: 5,
      downPaymentAmountPln: 5500,
      monthlyRateNet: 1520,
      monthlyRateGross: 1869.6,
      rateSource: 'PARTNER_MATRIX',
    },
  ],
};

describe('RentalOfferDetailPage Component (Discrete Calculator & Inquiry)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/najem/rental-offer-1']}>
            <Routes>
              <Route path="/najem/:id" element={<RentalOfferDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );
  };

  it('renders vehicle specs, photos, and default calculation (36 months, 20k km, 0% down)', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOfferDetails').mockResolvedValue(mockRentalOfferDetails);

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Toyota Corolla/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('1.8 Hybrid Comfort').length).toBeGreaterThanOrEqual(1);
    });

    // Verify default discrete option selected: 36M / 20k km / 0% -> 1450 zł netto / 1783,5 zł brutto
    expect(screen.getAllByText(/1\s?450 zł/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/1\s?783,5 zł/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Stawka partnerska')).toBeInTheDocument();
  });

  it('updates monthly rate when user clicks on different contract parameters', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOfferDetails').mockResolvedValue(mockRentalOfferDetails);

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Toyota Corolla/).length).toBeGreaterThanOrEqual(1);
    });

    // Click on 10% down payment
    const downPayment10Btn = screen.getByRole('button', { name: '10%' });
    fireEvent.click(downPayment10Btn);

    // Rate for 36M / 20k / 10% should be 1150 zł netto / 1414,5 zł brutto
    await waitFor(() => {
      expect(screen.getAllByText(/1\s?150 zł/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/1\s?414,5 zł/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/11\s?000 zł/)).toBeInTheDocument(); // 10% down payment amount
    });
  });

  it('toggles between B2B and Consumer modes and displays appropriate rate priorities', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOfferDetails').mockResolvedValue(mockRentalOfferDetails);

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Toyota Corolla/).length).toBeGreaterThanOrEqual(1);
    });

    // By default for non-B2B offer, clientType is CONSUMER
    expect(screen.getByText('Rata najmu brutto')).toBeInTheDocument();

    // Toggle to Firma (B2B)
    const b2bBtn = screen.getByRole('button', { name: /Firma \(B2B\)/i });
    fireEvent.click(b2bBtn);

    expect(screen.getByText('Rata najmu netto')).toBeInTheDocument();
    expect(screen.getByText('Rata abonamentowa netto')).toBeInTheDocument();
  });

  it('opens InquiryModal with rental selection when user clicks "Zapytaj o tę ofertę"', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOfferDetails').mockResolvedValue(mockRentalOfferDetails);
    vi.spyOn(authApi, 'fetchCsrfToken').mockResolvedValue('test-csrf-token');
    const submitSpy = vi.spyOn(inquiriesApi, 'submitEmployeeInquiry').mockResolvedValue({
      inquiry: {
        id: 'inq-123',
        status: 'NEW',
        referenceNumber: 'PP-2603-TEST',
        createdAt: new Date().toISOString(),
        vehicle: null,
        pricing: null,
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Toyota Corolla/).length).toBeGreaterThanOrEqual(1);
    });

    // Click "Zapytaj o tę ofertę"
    const openInquiryBtn = screen.getByRole('button', { name: /Zapytaj o tę ofertę/i });
    fireEvent.click(openInquiryBtn);

    // Verify modal is open and shows rental details without supplier name
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Wybrane parametry najmu:')).toBeInTheDocument();
    expect(screen.queryByText('Arval')).not.toBeInTheDocument();

    // Check privacy consent and submit
    const consentCheckbox = screen.getByRole('checkbox');
    fireEvent.click(consentCheckbox);

    const submitBtn = screen.getByRole('button', { name: /Wyślij zapytanie/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith(
        '/api',
        expect.objectContaining({
          offerId: 'rental-offer-1',
          rentalSelection: expect.objectContaining({
            contractMonths: 36,
            annualMileageKm: 20000,
            initialPaymentPct: 0,
          }),
        })
      );
    });
  });
});
