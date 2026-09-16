import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MyInquiriesPage } from './MyInquiriesPage';
import { BrandProvider } from '../../config/BrandContext';
import { AuthProvider } from '../auth/AuthContext';
import * as authApi from '../auth/auth-api';
import * as inquiriesApi from './inquiries-api';

const mockUser: authApi.EmployeeUser = {
  id: 'acc_emp_1',
  email: 'tomasz@action.pl',
  firstName: 'Tomasz',
  lastName: 'Kowalski',
  company: {
    id: 'c1',
    name: 'Action S.A.',
    slug: 'action'
  },
  program: {
    id: 'p1',
    name: 'Action Flota',
    slug: 'action-flota'
  }
};

const mockInquiriesList: inquiriesApi.EmployeeInquiryItem[] = [
  {
    id: 'inq_1',
    status: 'NEW',
    referenceNumber: 'PP-12345678',
    contractParty: 'CONSUMER',
    createdAt: '2026-09-16T08:00:00.000Z',
    contactName: 'Tomasz Kowalski',
    contactEmail: 'tomasz@action.pl',
    contactPhone: '+48 500 100 200',
    nip: null,
    notes: 'Preferowany termin odbioru w październiku.',
    vehicle: {
      make: 'Toyota',
      model: 'Yaris',
      version: 'Hybrid Comfort',
      productionYear: 2026,
      primaryImageUrl: 'https://images.motolia.pl/yaris.jpg'
    },
    pricing: {
      listPricePln: 71900,
      employeePricePln: 66148,
      savingsPln: 5752,
      discountPct: 8.0
    },
    benefit: {
      name: 'Pakiet Powitalny Moya',
      moyaCardAmount: 500,
      fuelDiscount: '15 gr/l',
      consultantCare: true,
      termsText: null
    }
  },
  {
    id: 'inq_2',
    status: 'IN_PROGRESS',
    referenceNumber: 'PP-87654321',
    contractParty: 'EMPLOYEE_B2B',
    createdAt: '2026-09-15T12:00:00.000Z',
    contactName: 'Tomasz Kowalski',
    contactEmail: 'tomasz@action.pl',
    contactPhone: '+48 500 100 200',
    nip: '5213876543',
    notes: null,
    vehicle: {
      make: 'Lexus',
      model: 'NX',
      version: '350h F Sport',
      productionYear: 2026,
      primaryImageUrl: null
    },
    pricing: {
      listPricePln: 250000,
      employeePricePln: 220000,
      savingsPln: 30000,
      discountPct: 12.0
    },
    benefit: null
  }
];

const renderMyInquiriesPage = () => {
  return render(
    <BrandProvider initialConfig={{ brandName: 'Action Auto Program', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/zapytania']}>
          <MyInquiriesPage />
        </MemoryRouter>
      </AuthProvider>
    </BrandProvider>
  );
};

describe('MyInquiriesPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockUser);
  });

  it('renders skeleton loader while inquiries are being loaded', async () => {
    // Hold pending promise to inspect loading state
    vi.spyOn(inquiriesApi, 'fetchEmployeeInquiries').mockImplementation(
      () => new Promise(() => {})
    );

    renderMyInquiriesPage();

    await waitFor(() => {
      expect(screen.getByTestId('inquiries-skeleton')).toBeInTheDocument();
    });
  });

  it('renders list of employee inquiries with vehicles, pricing, references, and party types', async () => {
    vi.spyOn(inquiriesApi, 'fetchEmployeeInquiries').mockResolvedValue({
      inquiries: mockInquiriesList,
      nextCursor: null
    });

    renderMyInquiriesPage();

    await waitFor(() => {
      expect(screen.getByText('PP-12345678')).toBeInTheDocument();
      expect(screen.getByText('PP-87654321')).toBeInTheDocument();
    });

    // Verify Vehicle 1 details
    expect(screen.getByText(/Toyota Yaris/i)).toBeInTheDocument();
    expect(screen.getByText(/Hybrid Comfort/i)).toBeInTheDocument();
    expect(screen.getByText(/66\s?148/i)).toBeInTheDocument();
    expect(screen.getByText(/Osoba prywatna \(Konsument\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Pakiet Powitalny Moya/i)).toBeInTheDocument();
    expect(screen.getByText(/Preferowany termin odbioru w październiku/i)).toBeInTheDocument();

    // Verify Vehicle 2 details
    expect(screen.getByText(/Lexus NX/i)).toBeInTheDocument();
    expect(screen.getByText(/220\s?000/i)).toBeInTheDocument();
    expect(screen.getByText(/Działalność gospodarcza \(B2B\)/i)).toBeInTheDocument();
    expect(screen.getByText(/5213876543/i)).toBeInTheDocument();
  });

  it('renders empty state when employee has no inquiries', async () => {
    vi.spyOn(inquiriesApi, 'fetchEmployeeInquiries').mockResolvedValue({
      inquiries: [],
      nextCursor: null
    });

    renderMyInquiriesPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Brak złożonych zapytań/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Przejdź do katalogu/i })).toBeInTheDocument();
    });
  });

  it('renders error state on API failure and retries loading when retry button is clicked', async () => {
    let callCount = 0;
    vi.spyOn(inquiriesApi, 'fetchEmployeeInquiries').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Awaria bazy danych CRM');
      }
      return {
        inquiries: mockInquiriesList,
        nextCursor: null
      };
    });

    renderMyInquiriesPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Awaria bazy danych CRM/i);
    });

    // Click retry button
    const retryBtn = screen.getByRole('button', { name: /Spróbuj ponownie/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('PP-12345678')).toBeInTheDocument();
    });
  });

  it('handles employee logout and navigates away', async () => {
    vi.spyOn(inquiriesApi, 'fetchEmployeeInquiries').mockResolvedValue({
      inquiries: [],
      nextCursor: null
    });
    const logoutSpy = vi.spyOn(authApi, 'logoutEmployee').mockResolvedValue();

    renderMyInquiriesPage();

    await waitFor(() => {
      expect(screen.getByText('Tomasz Kowalski')).toBeInTheDocument();
    });

    const logoutBtn = screen.getByRole('button', { name: /Wyloguj/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('renders rental inquiry details with contract terms, rates, and rental company', async () => {
    const rentalInquiry: inquiriesApi.EmployeeInquiryItem = {
      id: 'inq_rental_1',
      status: 'NEW',
      referenceNumber: 'PP-2609-0001',
      contractParty: 'EMPLOYEE_B2B',
      sourceType: 'RENTAL',
      createdAt: '2026-09-16T14:00:00.000Z',
      contactName: 'Tomasz Kowalski',
      contactEmail: 'tomasz@action.pl',
      contactPhone: '+48 500 100 200',
      nip: '5213876543',
      notes: 'Najem na 36 miesięcy',
      vehicle: {
        make: 'Audi',
        model: 'A4',
        version: 'S-Line',
        productionYear: 2026,
        primaryImageUrl: null
      },
      rental: {
        assignmentId: 'asgn_1',
        contractMonths: 36,
        annualMileageKm: 20000,
        annualMileage: 20000,
        initialPaymentPct: 10,
        downPaymentPct: 10,
        initialPaymentAmountNet: 15000,
        downPaymentAmountPln: 15000,
        monthlyRateNet: 2450,
        monthlyRateNetPln: 2450,
        monthlyRateGross: 3013.5,
        monthlyRateGrossPln: 3013.5,
        rateSource: 'PARTNER_MATRIX',
        rentalCompanyName: 'Arval Fleet Services'
      },
      pricing: null,
      benefit: null
    };

    vi.spyOn(inquiriesApi, 'fetchEmployeeInquiries').mockResolvedValue({
      inquiries: [rentalInquiry],
      nextCursor: null
    });

    renderMyInquiriesPage();

    await waitFor(() => {
      expect(screen.getByText('PP-2609-0001')).toBeInTheDocument();
    });

    expect(screen.getByText(/Audi A4/i)).toBeInTheDocument();
    expect(screen.getByText(/36\s*mies\.\s*·/i)).toBeInTheDocument();
    expect(screen.getByText(/20[\s\u00a0]?000\s*km\/rok/i)).toBeInTheDocument();
    expect(screen.getByText(/2450\s*zł/i)).toBeInTheDocument();
    expect(screen.getByText(/netto \/ mc/i)).toBeInTheDocument();
    expect(screen.getByText(/Wpłata wstępna: 10%/i)).toBeInTheDocument();
    expect(screen.getByText(/15[\s\u00a0]?000\s*zł/i)).toBeInTheDocument();
    expect(screen.getByText(/Dostawca: Arval Fleet Services/i)).toBeInTheDocument();
  });
});

