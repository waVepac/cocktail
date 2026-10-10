import { AuthUser } from './user.model';

// Risposta condivisa da POST /api/auth/login e POST /api/auth/register.
export interface AuthModel {
  token: string;
  user: AuthUser;
}

export type AuthSession = AuthModel;
