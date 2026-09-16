import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InquiryModal } from './InquiryModal';
import { BrandProvider } from '../../config/BrandContext';
import { AuthProvider } from '../auth/AuthContext';
import * as authApi from '../auth/auth-api';
import * as inquiriesApi from './inquiries-api';
import { EmployeeOffer } from '../catalog/catalog-api';

const mockOffer: EmployeeOffer = {
  id: 'offer_test_1',
  sourceType: 'FINANCING',
  vehicle: {
    make: 'Toyota',
    model: 'Corolla',
    version: '1.8 Hybrid Comfort',
    productionYear: 2026,
    fuelType: 'HYBRID',
    transmission: 'AUTOMATIC',
    bodyType: 'KOMBI',
    primaryImageUrl: 'https://images.motolia.pl/corolla.jpg',
    imageUrls: ['https://images.motolia.pl/corolla.jpg']
  },
  pricing: {
    listPricePln: 110000,
    employeePricePln: 99000,
    savingsPln: 11000,
    discountPct: 10.0
  },
  benefit: {
    name: 'Karta Paliwowa Moya',
    moyaCardAmount: 1000,
    fuelDiscount: '20 gr/l',
    consultantCare: true,
    termsText: null
  }
};

const mockUser: authApi.EmployeeUser = {
  id: 'acc_test_1',
  email: 'anna.nowak@firma.pl',
  firstName: 'Anna',
  lastName: 'Nowak',
  phone: '+48 600 700 800',
  company: {
    id: 'c1',
    name: 'Tech Corp S.A.',
    slug: 'tech-corp'
  },
  program: {
    id: 'p1',
    name: 'Tech Auto Program',
    slug: 'tech-auto'
  }
};

const renderModal = (props: {
  isOpen: boolean;
  onClose: () => void;
  offer: EmployeeOffer | null;
  onViewMyInquiries?: () => void;
}) => {
  return render(
    <BrandProvider initialConfig={{ brandName: 'Test Portal', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
      <AuthProvider>
        <InquiryModal {...props} />
      </AuthProvider>
    </BrandProvider>
  );
};

describe('InquiryModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockUser);
  });

  it('renders nothing when isOpen is false or offer is null', () => {
    const { rerender } = renderModal({ isOpen: false, onClose: vi.fn(), offer: mockOffer });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <BrandProvider initialConfig={{ brandName: 'Test Portal', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <InquiryModal isOpen={true} onClose={vi.fn()} offer={null} />
        </AuthProvider>
      </BrandProvider>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal with offer info and pre-fills user contact data', async () => {
    renderModal({ isOpen: true, onClose: vi.fn(), offer: mockOffer });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Zapytaj o tę ofertę/i })).toBeInTheDocument();
      expect(screen.getByText(/Toyota Corolla/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Imię i nazwisko/i) as HTMLInputElement;
    const emailInput = screen.getByLabelText(/Adres e-mail/i) as HTMLInputElement;
    const phoneInput = screen.getByLabelText(/Numer telefonu/i) as HTMLInputElement;

    await waitFor(() => {
      expect(nameInput.value).toBe('Anna Nowak');
      expect(emailInput.value).toBe('anna.nowak@firma.pl');
      expect(phoneInput.value).toBe('+48 600 700 800');
    });

    // Default: CONSUMER party selected, NIP input not visible
    expect(screen.queryByLabelText(/NIP Twojej działalności/i)).not.toBeInTheDocument();
  });

  it('displays NIP input when B2B or EMPLOYER_COMPANY is selected', async () => {
    renderModal({ isOpen: true, onClose: vi.fn(), offer: mockOffer });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Select B2B radio
    const b2bRadio = screen.getByDisplayValue('EMPLOYEE_B2B');
    fireEvent.click(b2bRadio);

    expect(screen.getByLabelText(/NIP Firmy/i)).toBeInTheDocument();

    // Select EMPLOYER_COMPANY radio
    const companyRadio = screen.getByDisplayValue('EMPLOYER_COMPANY');
    fireEvent.click(companyRadio);

    expect(screen.getByLabelText(/NIP Firmy/i)).toBeInTheDocument();
    expect(screen.getByText(/Samochód służbowy finansowany bezpośrednio przez pracodawcę/i)).toBeInTheDocument();

    // Select back to CONSUMER
    const consumerRadio = screen.getByDisplayValue('CONSUMER');
    fireEvent.click(consumerRadio);

    expect(screen.queryByLabelText(/NIP Firmy/i)).not.toBeInTheDocument();
  });

  it('shows error validation when RODO consent is not checked', async () => {
    renderModal({ isOpen: true, onClose: vi.fn(), offer: mockOffer });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Wyślij zapytanie/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Wymagana jest zgoda na przetwarzanie danych osobowych/i);
    });
  });

  it('shows error validation when B2B party is selected without valid NIP', async () => {
    renderModal({ isOpen: true, onClose: vi.fn(), offer: mockOffer });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Check RODO checkbox
    const rodoCheckbox = screen.getByRole('checkbox');
    fireEvent.click(rodoCheckbox);

    // Switch to B2B
    const b2bRadio = screen.getByDisplayValue('EMPLOYEE_B2B');
    fireEvent.click(b2bRadio);

    const submitBtn = screen.getByRole('button', { name: /Wyślij zapytanie/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Podaj poprawny numer NIP/i);
    });
  });

  it('successfully submits inquiry and renders confirmation screen with reference number', async () => {
    const onClose = vi.fn();
    const onViewMyInquiries = vi.fn();

    const submitSpy = vi.spyOn(inquiriesApi, 'submitEmployeeInquiry').mockResolvedValue({
      inquiry: {
        id: 'inq_123',
        status: 'NEW',
        referenceNumber: 'AF-87654321',
        createdAt: new Date().toISOString(),
        vehicle: {
          make: 'Toyota',
          model: 'Corolla',
          version: '1.8 Hybrid Comfort',
          productionYear: 2026,
          primaryImageUrl: null
        },
        pricing: null
      }
    });

    renderModal({ isOpen: true, onClose, offer: mockOffer, onViewMyInquiries });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Check RODO
    const rodoCheckbox = screen.getByRole('checkbox');
    fireEvent.click(rodoCheckbox);

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Wyślij zapytanie/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('heading', { name: /Dziękujemy za przesłanie zgłoszenia!/i })).toBeInTheDocument();
      expect(screen.getByText('AF-87654321')).toBeInTheDocument();
    });

    // Click "Zobacz moje zapytania"
    const viewInquiriesBtn = screen.getByRole('button', { name: /Zobacz moje zapytania/i });
    fireEvent.click(viewInquiriesBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onViewMyInquiries).toHaveBeenCalled();
  });

  it('preserves idempotencyKey on retry after submission error', async () => {
    const payloads: inquiriesApi.CreateInquiryPayload[] = [];

    vi.spyOn(inquiriesApi, 'submitEmployeeInquiry').mockImplementation(async (_url, payload) => {
      payloads.push(payload);
      if (payloads.length === 1) {
        throw new Error('Tymczasowy błąd sieci');
      }
      return {
        inquiry: {
          id: 'inq_success',
          status: 'NEW',
          referenceNumber: 'AF-11223344',
          createdAt: new Date().toISOString(),
          vehicle: null,
          pricing: null
        }
      };
    });

    renderModal({ isOpen: true, onClose: vi.fn(), offer: mockOffer });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const rodoCheckbox = screen.getByRole('checkbox');
    fireEvent.click(rodoCheckbox);

    const submitBtn = screen.getByRole('button', { name: /Wyślij zapytanie/i });
    fireEvent.click(submitBtn);

    // First attempt fails
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Tymczasowy błąd sieci/i);
    });

    expect(payloads.length).toBe(1);

    // Retry with same button
    fireEvent.click(screen.getByRole('button', { name: /Wyślij zapytanie/i }));

    // Second attempt succeeds
    await waitFor(() => {
      expect(screen.getByText('AF-11223344')).toBeInTheDocument();
    });

    expect(payloads.length).toBe(2);
    // Idempotency key MUST be preserved across retry
    expect(payloads[0].idempotencyKey).toBe(payloads[1].idempotencyKey);
  });
});
