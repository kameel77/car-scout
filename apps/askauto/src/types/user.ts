export type UserRole = 'admin' | 'manager';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserPayload {
  email: string;
  name?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}
