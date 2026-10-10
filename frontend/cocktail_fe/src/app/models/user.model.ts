// Utente pubblico restituito dal backend Node: nessuna password o token nell'utente.
export interface UserModel {
  id: number;
  username: string;
}

export type AuthUser = UserModel;