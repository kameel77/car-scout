export interface EmployeeJwtPayload {
  accountId: string;
  email: string;
  companyId: string;
  programId: string;
  realm: 'employee';
  aud: 'employee-portal';
  jti: string;
  exp?: number;
  iat?: number;
}

export interface EmployeeCsrfJwtPayload {
  realm: 'employee-csrf';
  aud: 'employee-csrf';
  nonce: string;
  exp?: number;
  iat?: number;
}

export interface EmployeeProfileResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  company: {
    id: string;
    name: string;
    slug: string;
  };
  program: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt: string;
}

export interface ValidateCodeResult {
  valid: boolean;
  companyId: string;
  companyName: string;
  programId: string;
  programName: string;
}

export interface CsrfTokenResponse {
  csrfToken: string;
  headerName: string;
}
