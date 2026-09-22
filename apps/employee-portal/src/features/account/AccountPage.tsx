import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  UserCircle2,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Building2,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useBrandConfig } from '../../config/BrandContext';
import { updateEmployeeProfile, changeEmployeePassword } from '../auth/auth-api';
import { PortalHeader } from '../common/PortalHeader';
import { PortalFooter } from '../common/PortalFooter';

function calculatePasswordStrength(pass: string): { score: number; label: string; colorClass: string } {
  if (!pass) return { score: 0, label: '', colorClass: 'bg-line' };

  let score = 0;
  if (pass.length >= 8) score += 1;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
  if (/\d/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 1) {
    return { score: 1, label: 'Słabe', colorClass: 'bg-red-500' };
  } else if (score <= 3) {
    return { score: score, label: 'Średnie', colorClass: 'bg-amber-500' };
  } else {
    return { score: 4, label: 'Silne', colorClass: 'bg-emerald-600' };
  }
}

export const AccountPage: React.FC = () => {
  const { user, refreshSession } = useAuth();
  const { config } = useBrandConfig();
  const location = useLocation();

  // Profile Form States
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileErrors, setProfileErrors] = useState<Record<string, string | null>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string | null>>({});
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Synchronize initial state from user
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  // Scroll to #haslo if opened via direct link or menu item
  useEffect(() => {
    if (location.hash === '#haslo') {
      const el = document.getElementById('haslo');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location.hash]);

  // Validate Profile Fields
  const validateProfileField = (field: string, val: string): string | null => {
    let err: string | null = null;
    const v = val.trim();
    if (field === 'firstName') {
      if (!v) err = 'Imię jest wymagane.';
    } else if (field === 'lastName') {
      if (!v) err = 'Nazwisko jest wymagane.';
    } else if (field === 'phone') {
      if (v && v.replace(/\D/g, '').length < 7) {
        err = 'Proszę podać poprawny numer telefonu (min. 7 cyfr).';
      }
    }
    setProfileErrors((prev) => ({ ...prev, [field]: err }));
    return err;
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const errFirst = validateProfileField('firstName', firstName);
    const errLast = validateProfileField('lastName', lastName);
    const errPhone = validateProfileField('phone', phone);

    if (errFirst || errLast || errPhone) {
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateEmployeeProfile(config.apiUrl, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null
      });
      await refreshSession();
      setProfileSuccess('Twoje dane zostały pomyślnie zaktualizowane.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nie udało się zaktualizować danych';
      setProfileError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Validate Password Fields
  const validatePasswordField = (field: string, val: string): string | null => {
    let err: string | null = null;
    if (field === 'currentPassword') {
      if (!val) err = 'Obecne hasło jest wymagane.';
    } else if (field === 'newPassword') {
      if (!val) {
        err = 'Nowe hasło jest wymagane.';
      } else if (val.length < 8) {
        err = 'Hasło musi zawierać co najmniej 8 znaków.';
      } else {
        const byteLen = new TextEncoder().encode(val).length;
        if (byteLen > 72) {
          err = 'Hasło jest za długie (maks. 72 znaki).';
        }
      }
    } else if (field === 'confirmPassword') {
      if (!val) {
        err = 'Powtórz nowe hasło.';
      } else if (val !== newPassword) {
        err = 'Hasła nie są identyczne.';
      }
    }
    setPasswordErrors((prev) => ({ ...prev, [field]: err }));
    return err;
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    const errCurrent = validatePasswordField('currentPassword', currentPassword);
    const errNew = validatePasswordField('newPassword', newPassword);
    const errConfirm = validatePasswordField('confirmPassword', confirmPassword);

    if (errCurrent || errNew || errConfirm) {
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changeEmployeePassword(config.apiUrl, {
        currentPassword,
        newPassword
      });
      setPasswordSuccess(res.message || 'Hasło zmienione. Pozostałe urządzenia zostały wylogowane.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nie udało się zmienić hasła';
      setPasswordError(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const passwordStrength = calculatePasswordStrength(newPassword);

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <PortalHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb & Header */}
        <div className="mb-8">
          <nav className="flex items-center gap-2 text-xs text-muted mb-2">
            <Link to="/katalog" className="hover:text-ink transition-colors">
              Katalog
            </Link>
            <span>/</span>
            <span className="text-ink font-medium">Ustawienia konta</span>
          </nav>
          <h1 className="text-3xl font-bold font-heading text-ink tracking-tight">
            Ustawienia konta
          </h1>
          <p className="text-sm text-muted mt-1">
            Zarządzaj swoimi danymi osobowymi i bezpieczeństwem dostępu do programu.
          </p>
        </div>

        {/* Section 1: Personal Profile Data */}
        <section className="bg-white rounded-2xl border border-line p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-line">
            <div className="w-10 h-10 rounded-full bg-paper border border-line flex items-center justify-center text-ink">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-heading text-ink">Moje dane</h2>
              <p className="text-xs text-muted">Informacje profilowe powiązane z Twoim kontem pracowniczym</p>
            </div>
          </div>

          {profileSuccess && (
            <div role="status" className="mb-6 flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div role="alert" className="mb-6 flex items-center gap-2 text-xs text-red-800 bg-red-50 border border-red-200 p-3.5 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} noValidate className="space-y-5">
            {/* Read-only corporate metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 rounded-xl bg-paper border border-line">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">
                  Służbowy adres e-mail
                </label>
                <div className="text-sm font-semibold text-ink break-all">
                  {user?.email || '-'}
                </div>
                <p className="text-[11px] text-muted mt-1">
                  Zmiana adresu e-mail wymaga kontaktu z doradcą.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">
                  Firma pracodawcy
                </label>
                <div className="text-sm font-semibold text-ink flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-muted" />
                  <span>{user?.company?.name || '-'}</span>
                </div>
                {user?.program?.name && (
                  <p className="text-[11px] text-muted mt-1 flex items-center gap-1">
                    <Briefcase className="h-3 w-3 text-muted" />
                    <span>Program: {user.program.name}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="firstName">
                  Imię *
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (profileErrors.firstName) setProfileErrors((prev) => ({ ...prev, firstName: null }));
                  }}
                  onBlur={(e) => validateProfileField('firstName', e.target.value)}
                  aria-invalid={!!profileErrors.firstName}
                  aria-describedby={profileErrors.firstName ? 'firstName-error' : undefined}
                  className={`w-full bg-paper border ${
                    profileErrors.firstName ? 'border-red-500 ring-1 ring-red-500' : 'border-line'
                  } rounded-xl px-3.5 py-2.5 text-ink focus:bg-white transition-colors`}
                />
                {profileErrors.firstName && (
                  <p id="firstName-error" className="text-xs text-red-600 mt-1">
                    {profileErrors.firstName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="lastName">
                  Nazwisko *
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (profileErrors.lastName) setProfileErrors((prev) => ({ ...prev, lastName: null }));
                  }}
                  onBlur={(e) => validateProfileField('lastName', e.target.value)}
                  aria-invalid={!!profileErrors.lastName}
                  aria-describedby={profileErrors.lastName ? 'lastName-error' : undefined}
                  className={`w-full bg-paper border ${
                    profileErrors.lastName ? 'border-red-500 ring-1 ring-red-500' : 'border-line'
                  } rounded-xl px-3.5 py-2.5 text-ink focus:bg-white transition-colors`}
                />
                {profileErrors.lastName && (
                  <p id="lastName-error" className="text-xs text-red-600 mt-1">
                    {profileErrors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="phone">
                Numer telefonu
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (profileErrors.phone) setProfileErrors((prev) => ({ ...prev, phone: null }));
                }}
                onBlur={(e) => validateProfileField('phone', e.target.value)}
                aria-invalid={!!profileErrors.phone}
                aria-describedby={profileErrors.phone ? 'phone-error' : undefined}
                placeholder="+48 500 000 000"
                className={`w-full sm:max-w-md bg-paper border ${
                  profileErrors.phone ? 'border-red-500 ring-1 ring-red-500' : 'border-line'
                } rounded-xl px-3.5 py-2.5 text-ink focus:bg-white transition-colors`}
              />
              {profileErrors.phone && (
                <p id="phone-error" className="text-xs text-red-600 mt-1">
                  {profileErrors.phone}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex items-center justify-center px-6 py-2.5 min-h-[44px] bg-ink hover:bg-ink/90 text-paper text-sm font-semibold rounded-full transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSavingProfile ? 'Zapisywanie...' : 'Zapisz zmiany'}
              </button>
            </div>
          </form>
        </section>

        {/* Section 2: Password Change */}
        <section id="haslo" className="bg-white rounded-2xl border border-line p-6 sm:p-8 shadow-xs mb-8 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-line">
            <div className="w-10 h-10 rounded-full bg-paper border border-line flex items-center justify-center text-ink">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-heading text-ink">Zmiana hasła</h2>
              <p className="text-xs text-muted">Zaktualizuj swoje hasło logowania do portalu</p>
            </div>
          </div>

          {passwordSuccess && (
            <div role="status" className="mb-6 flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div role="alert" className="mb-6 flex items-center gap-2 text-xs text-red-800 bg-red-50 border border-red-200 p-3.5 rounded-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
              <span>{passwordError}</span>
            </div>
          )}

          <div className="text-xs text-muted bg-paper border border-line p-3.5 rounded-xl mb-5">
            Po zmianie hasła wszystkie pozostałe sesje na innych urządzeniach zostaną automatycznie wylogowane.
          </div>

          <form onSubmit={handlePasswordSubmit} noValidate className="space-y-5 max-w-lg">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="currentPassword">
                Obecne hasło *
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (passwordErrors.currentPassword) setPasswordErrors((prev) => ({ ...prev, currentPassword: null }));
                  }}
                  onBlur={(e) => validatePasswordField('currentPassword', e.target.value)}
                  aria-invalid={!!passwordErrors.currentPassword}
                  aria-describedby={passwordErrors.currentPassword ? 'currentPassword-error' : undefined}
                  className={`w-full bg-paper border ${
                    passwordErrors.currentPassword ? 'border-red-500 ring-1 ring-red-500' : 'border-line'
                  } rounded-xl pl-3.5 pr-12 py-2.5 text-ink focus:bg-white transition-colors`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors p-1"
                  aria-label={showCurrentPassword ? 'Ukryj obecne hasło' : 'Pokaż obecne hasło'}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordErrors.currentPassword && (
                <p id="currentPassword-error" className="text-xs text-red-600 mt-1">
                  {passwordErrors.currentPassword}
                </p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="newPassword">
                Nowe hasło *
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordErrors.newPassword) setPasswordErrors((prev) => ({ ...prev, newPassword: null }));
                  }}
                  onBlur={(e) => validatePasswordField('newPassword', e.target.value)}
                  aria-invalid={!!passwordErrors.newPassword}
                  aria-describedby={passwordErrors.newPassword ? 'newPassword-error' : undefined}
                  className={`w-full bg-paper border ${
                    passwordErrors.newPassword ? 'border-red-500 ring-1 ring-red-500' : 'border-line'
                  } rounded-xl pl-3.5 pr-12 py-2.5 text-ink focus:bg-white transition-colors`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors p-1"
                  aria-label={showNewPassword ? 'Ukryj nowe hasło' : 'Pokaż nowe hasło'}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password strength bar */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          step <= passwordStrength.score ? passwordStrength.colorClass : 'bg-line'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[11px] text-muted">
                    <span>Siła hasła: <strong className="text-ink">{passwordStrength.label}</strong></span>
                    <span>min. 8 znaków</span>
                  </div>
                </div>
              )}

              {passwordErrors.newPassword && (
                <p id="newPassword-error" className="text-xs text-red-600 mt-1">
                  {passwordErrors.newPassword}
                </p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5" htmlFor="confirmPassword">
                Powtórz nowe hasło *
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordErrors.confirmPassword) setPasswordErrors((prev) => ({ ...prev, confirmPassword: null }));
                  }}
                  onBlur={(e) => validatePasswordField('confirmPassword', e.target.value)}
                  aria-invalid={!!passwordErrors.confirmPassword}
                  aria-describedby={passwordErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                  className={`w-full bg-paper border ${
                    passwordErrors.confirmPassword ? 'border-red-500 ring-1 ring-red-500' : 'border-line'
                  } rounded-xl pl-3.5 pr-12 py-2.5 text-ink focus:bg-white transition-colors`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors p-1"
                  aria-label={showConfirmPassword ? 'Ukryj powtórzone hasło' : 'Pokaż powtórzone hasło'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordErrors.confirmPassword && (
                <p id="confirmPassword-error" className="text-xs text-red-600 mt-1">
                  {passwordErrors.confirmPassword}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="inline-flex items-center justify-center px-6 py-2.5 min-h-[44px] bg-ink hover:bg-ink/90 text-paper text-sm font-semibold rounded-full transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isChangingPassword ? 'Zmienianie...' : 'Zmień hasło'}
              </button>
            </div>
          </form>
        </section>
      </main>

      <PortalFooter />
    </div>
  );
};

export default AccountPage;
