import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthSessionService } from '../auth/auth-session.service';

@Injectable()
export class ApiInterceptionService implements HttpInterceptor {
  constructor(private session: AuthSessionService) { }

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const backend = new URL(environment.apiUrl, window.location.origin);
    const target = new URL(req.url, window.location.origin);
    const apiPath = backend.pathname.replace(/\/$/, '') + '/api/';
    const localApi = target.origin === backend.origin && target.pathname.startsWith(apiPath);
    const publicAuth = target.pathname === apiPath + 'auth/login' || target.pathname === apiPath + 'auth/register';
    const token = localApi && !publicAuth ? this.session.token : undefined;
    if (token) {
      req = req.clone({ setHeaders: { Authorization: 'Bearer ' + token } });
    }
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (token && error.status === 401 && token === this.session.token) {
          this.session.clear();
        }
        return throwError(() => error);
      })
    );
  }
}
