import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, of, tap, timeout } from 'rxjs';
import { ApiService } from '../service/api.service';
import { AuthSessionService } from './auth-session.service';
import { AuthUser } from '../../models/user.model';

export type UserType = AuthUser | undefined;

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser$ = this.session.user$.asObservable();
  readonly isLoadingSubject = new BehaviorSubject(false);
  readonly isLoading$ = this.isLoadingSubject.asObservable();
  readonly sessionError$ = new BehaviorSubject('');
  loginMode: 'login' | 'register' = 'login';
  readonly loginOpen$ = new BehaviorSubject(false);

  constructor(private api: ApiService, private session: AuthSessionService) { }

  get currentUserValue(): UserType {
    return this.session.user$.value;
  }

  get hasSavedSession(): boolean {
    return !!this.session.token;
  }

  login(username: string, password: string): Observable<AuthUser> {
    this.isLoadingSubject.next(true);
    this.sessionError$.next('');
    return this.api.login(username, password).pipe(
      timeout(10000),
      tap(session => this.session.save(session)),
      tap(() => this.closeLogin()),
      map(session => session.user),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  register(username: string, password: string): Observable<AuthUser> {
    this.isLoadingSubject.next(true);
    this.sessionError$.next('');
    return this.api.register(username, password).pipe(
      timeout(10000),
      tap(session => this.session.save(session)),
      tap(() => this.closeLogin()),
      map(session => session.user),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getUserByToken(): Observable<UserType> {
    if (!this.session.token) {
      return of(undefined);
    }
    const token = this.session.token;
    this.isLoadingSubject.next(true);
    this.sessionError$.next('');
    // Il backend attuale non espone /auth/me. Questo GET protetto convalida il token senza scrivere dati.
    return this.api.getFavorites().pipe(
      timeout(10000),
      map(() => token === this.session.token ? this.session.savedUser : undefined),
      tap(user => this.session.user$.next(user)),
      tap(user => {
        if (user) {
          this.closeLogin();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.session.clear();
          this.sessionError$.next('Sessione non valida. Accedi di nuovo.');
        } else {
          this.sessionError$.next('Non riesco a verificare la sessione. Controlla il backend e riprova.');
        }
        return of(undefined);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  openLogin(mode: 'login' | 'register' = 'login'): void {
    if (!this.currentUserValue) {
      this.loginMode = mode;
      this.loginOpen$.next(true);
    }
  }

  closeLogin(): void {
    this.loginOpen$.next(false);
  }

  logout(): void {
    this.closeLogin();
    this.session.clear();
    this.sessionError$.next('');
  }
}

