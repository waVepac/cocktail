import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthUser } from '../../models/user.model';
import { AuthSession } from '../../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  readonly storageKey = 'session-' + environment.USER_KEY;
  readonly user$ = new BehaviorSubject<AuthUser | undefined>(undefined);
  private session = this.read();

  get token(): string | undefined {
    return this.session?.token;
  }

  get savedUser(): AuthUser | undefined {
    return this.session?.user;
  }

  save(session: AuthSession): void {
    localStorage.setItem(this.storageKey, JSON.stringify(session));
    this.session = session;
    this.user$.next(session.user);

  }

  clear(): void {
    this.session = undefined;
    this.user$.next(undefined);
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem('token-' + environment.USER_KEY);
      localStorage.removeItem('user-' + environment.USER_KEY);
    } catch {
      // La sessione in memoria viene comunque chiusa se lo storage non è disponibile.
    }
  }

  private read(): AuthSession | undefined {
    try {
      const value = localStorage.getItem(this.storageKey);
      const session = value ? JSON.parse(value) : undefined;
      if (typeof session?.token === 'string' && session.token && Number.isFinite(session.user?.id) && typeof session.user?.username === 'string') {
        return session;
      }
      localStorage.removeItem(this.storageKey);
    } catch {
      // JSON corrotto o storage disabilitato: ripartiamo dal login.
    }
    return undefined;
  }
}
