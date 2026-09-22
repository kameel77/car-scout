import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AccountPage } from './AccountPage';
import { BrandProvider } from '../../config/BrandContext';
import { AuthProvider } from '../auth/AuthContext';
import * as authApi from '../auth/auth-api';

const mockEmployee: authApi.EmployeeUser = {
  id: 'acc_test_123',
  email: 'jan.kowalski@action.pl',
  firstName: 'Jan',
  lastName: 'Kowalski',
  phone: '+48 500 100 200',
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

describe('AccountPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockEmployee);
  });

  const renderAccountPage = (initialEntries = ['/konto']) => {
    return render(
      <BrandProvider initialConfig={{ brandName: 'Benefivo', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <AccountPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );
  };

  it('renders account page with personal data and read-only company metadata', async () => {
    renderAccountPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Ustawienia konta/i })).toBeInTheDocument();
      expect(screen.getByText('jan.kowalski@action.pl')).toBeInTheDocument();
      expect(screen.getAllByText('Action S.A.').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Action Flota/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Jan')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Kowalski')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+48 500 100 200')).toBeInTheDocument();
    });
  });

  it('updates employee profile successfully when form is submitted', async () => {
    const updateSpy = vi.spyOn(authApi, 'updateEmployeeProfile').mockResolvedValue({
      ...mockEmployee,
      firstName: 'Adam',
      lastName: 'Nowak',
      phone: '+48 600 700 800'
    });

    renderAccountPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jan')).toBeInTheDocument();
    });

    const firstNameInput = screen.getByLabelText(/Imię \*/i);
    const lastNameInput = screen.getByLabelText(/Nazwisko \*/i);
    const phoneInput = screen.getByLabelText(/Numer telefonu/i);

    fireEvent.change(firstNameInput, { target: { value: 'Adam' } });
    fireEvent.change(lastNameInput, { target: { value: 'Nowak' } });
    fireEvent.change(phoneInput, { target: { value: '+48 600 700 800' } });

    const submitBtn = screen.getByRole('button', { name: /Zapisz zmiany/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('/api', {
        firstName: 'Adam',
        lastName: 'Nowak',
        phone: '+48 600 700 800'
      });
      expect(screen.getByText(/Twoje dane zostały pomyślnie zaktualizowane/i)).toBeInTheDocument();
    });
  });

  it('shows inline validation error when required profile fields are cleared', async () => {
    renderAccountPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jan')).toBeInTheDocument();
    });

    const firstNameInput = screen.getByLabelText(/Imię \*/i);
    fireEvent.change(firstNameInput, { target: { value: '   ' } });
    fireEvent.blur(firstNameInput);

    expect(screen.getByText(/Imię jest wymagane/i)).toBeInTheDocument();
  });

  it('validates password change fields on blur', async () => {
    renderAccountPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Zmiana hasła/i })).toBeInTheDocument();
    });

    const currentPassInput = screen.getByLabelText(/Obecne hasło \*/i);
    fireEvent.change(currentPassInput, { target: { value: '' } });
    fireEvent.blur(currentPassInput);
    expect(screen.getByText(/Obecne hasło jest wymagane/i)).toBeInTheDocument();

    const newPassInput = screen.getByLabelText(/^Nowe hasło \*/i);
    fireEvent.change(newPassInput, { target: { value: 'short' } });
    fireEvent.blur(newPassInput);
    expect(screen.getByText(/Hasło musi zawierać co najmniej 8 znaków/i)).toBeInTheDocument();

    const confirmPassInput = screen.getByLabelText(/Powtórz nowe hasło \*/i);
    fireEvent.change(confirmPassInput, { target: { value: 'different123' } });
    fireEvent.blur(confirmPassInput);
    expect(screen.getByText(/Hasła nie są identyczne/i)).toBeInTheDocument();
  });

  it('successfully changes password and displays logout notification message', async () => {
    const changePassSpy = vi.spyOn(authApi, 'changeEmployeePassword').mockResolvedValue({
      message: 'Hasło zmienione. Pozostałe urządzenia zostały wylogowane.'
    });

    renderAccountPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Zmiana hasła/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Obecne hasło \*/i), {
      target: { value: 'OldPassword123!' }
    });
    fireEvent.change(screen.getByLabelText(/^Nowe hasło \*/i), {
      target: { value: 'NewSuperPassword123!' }
    });
    fireEvent.change(screen.getByLabelText(/Powtórz nowe hasło \*/i), {
      target: { value: 'NewSuperPassword123!' }
    });

    const submitBtn = screen.getByRole('button', { name: /Zmień hasło/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(changePassSpy).toHaveBeenCalledWith('/api', {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSuperPassword123!'
      });
      expect(screen.getByText(/Hasło zmienione\. Pozostałe urządzenia zostały wylogowane/i)).toBeInTheDocument();
    });
  });

  it('displays error message when password change fails from API', async () => {
    vi.spyOn(authApi, 'changeEmployeePassword').mockRejectedValue(
      new Error('Nieprawidłowe obecne hasło')
    );

    renderAccountPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Zmiana hasła/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Obecne hasło \*/i), {
      target: { value: 'WrongOldPassword!' }
    });
    fireEvent.change(screen.getByLabelText(/^Nowe hasło \*/i), {
      target: { value: 'NewSuperPassword123!' }
    });
    fireEvent.change(screen.getByLabelText(/Powtórz nowe hasło \*/i), {
      target: { value: 'NewSuperPassword123!' }
    });

    const submitBtn = screen.getByRole('button', { name: /Zmień hasło/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Nieprawidłowe obecne hasło/i)).toBeInTheDocument();
    });
  });
});
