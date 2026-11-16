export type UserRole = 'USER' | 'LEADER' | 'ADMIN' | 'DEV';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  sessionId: string;
}
