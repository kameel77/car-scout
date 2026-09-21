export interface EmployeeCompany {
  id: string;
  name: string;
  slug: string;
}

export interface EmployeeProgram {
  id: string;
  name: string;
  slug: string;
}

export interface EmployeeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company: EmployeeCompany;
  program: EmployeeProgram;
  createdAt?: string;
}

export interface ValidateCodeResponse {
  valid: boolean;
  companyId: string;
  companyName: string;
  programId: string;
  programName: string;
}

export interface CsrfResponse {
  csrfToken: string;
  headerName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  code: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

function normalizeBaseUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

async function handleResponseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string')
      ? data.message
      : `Błąd serwera (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchCsrfToken(apiUrl: string): Promise<string> {
  const base = normalizeBaseUrl(apiUrl);
  const res = await fetch(`${base}/employee/auth/csrf`, {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json',
    },
  });

  const data = await handleResponseJson<CsrfResponse>(res);
  return data.csrfToken;
}

export async function validateCompanyCode(apiUrl: string, code: string): Promise<ValidateCodeResponse> {
  const base = normalizeBaseUrl(apiUrl);
  const res = await fetch(`${base}/employee/auth/validate-code`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  return handleResponseJson<ValidateCodeResponse>(res);
}

export async function loginEmployee(apiUrl: string, payload: LoginPayload): Promise<EmployeeUser> {
  const base = normalizeBaseUrl(apiUrl);
  const csrfToken = await fetchCsrfToken(apiUrl);

  const res = await fetch(`${base}/employee/auth/login`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(payload),
  });

  const data = await handleResponseJson<{ employee: EmployeeUser }>(res);
  return data.employee;
}

export async function registerEmployee(apiUrl: string, payload: RegisterPayload): Promise<EmployeeUser> {
  const base = normalizeBaseUrl(apiUrl);
  const csrfToken = await fetchCsrfToken(apiUrl);

  const res = await fetch(`${base}/employee/auth/register`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(payload),
  });

  const data = await handleResponseJson<{ employee: EmployeeUser }>(res);
  return data.employee;
}

export async function fetchCurrentEmployee(apiUrl: string): Promise<EmployeeUser | null> {
  const base = normalizeBaseUrl(apiUrl);
  const res = await fetch(`${base}/employee/auth/me`, {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (res.status === 401 || res.status === 403) {
    return null;
  }

  const data = await handleResponseJson<{ employee: EmployeeUser }>(res);
  return data.employee;
}

export async function logoutEmployee(apiUrl: string): Promise<void> {
  const base = normalizeBaseUrl(apiUrl);
  let csrfToken = '';
  try {
    csrfToken = await fetchCsrfToken(apiUrl);
  } catch {
    // ignore csrf fetch error on logout fallback
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(`${base}/employee/auth/logout`, {
    method: 'POST',
    credentials: 'same-origin',
    headers,
  });

  await handleResponseJson<{ message: string }>(res);
}

export async function requestPasswordReset(apiUrl: string, email: string): Promise<{ message: string }> {
  const base = normalizeBaseUrl(apiUrl);
  const csrfToken = await fetchCsrfToken(apiUrl);

  const res = await fetch(`${base}/employee/auth/forgot-password`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ email }),
  });

  return handleResponseJson<{ message: string }>(res);
}

export async function resetEmployeePassword(
  apiUrl: string,
  payload: { token: string; password: string }
): Promise<{ message: string }> {
  const base = normalizeBaseUrl(apiUrl);
  const csrfToken = await fetchCsrfToken(apiUrl);

  const res = await fetch(`${base}/employee/auth/reset-password`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(payload),
  });

  return handleResponseJson<{ message: string }>(res);
}

export interface UpdateProfilePayload {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export async function updateEmployeeProfile(
  apiUrl: string,
  payload: UpdateProfilePayload
): Promise<EmployeeUser> {
  const base = normalizeBaseUrl(apiUrl);
  const csrfToken = await fetchCsrfToken(apiUrl);

  const res = await fetch(`${base}/employee/auth/me`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(payload),
  });

  const data = await handleResponseJson<{ employee: EmployeeUser }>(res);
  return data.employee;
}

export async function changeEmployeePassword(
  apiUrl: string,
  payload: ChangePasswordPayload
): Promise<{ message: string }> {
  const base = normalizeBaseUrl(apiUrl);
  const csrfToken = await fetchCsrfToken(apiUrl);

  const res = await fetch(`${base}/employee/auth/change-password`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(payload),
  });

  return handleResponseJson<{ message: string }>(res);
}
