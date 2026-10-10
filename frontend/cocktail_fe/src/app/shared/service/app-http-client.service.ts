import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppHttpClient {
  constructor(private http: HttpClient) { }

  get<T = any>(url: string): Observable<T> {
    return this.http.get<T>(url);
  }

  post<T = any>(url: string, data: unknown): Observable<T> {
    return this.http.post<T>(url, data);
  }

  getExternal<T = any>(url: string): Observable<T> {
    return this.http.get<T>(url);
  }
}
