import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler, HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { LocaleService } from '../services/locale.service';

/**
 * Attaches the stored JWT access token as a Bearer header to every
 * outgoing HTTP request — except the login / refresh endpoints themselves.
 * Also adds Accept-Language header for i18n support.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);

  private readonly skipUrls = [
    '/api/auth/login',
    '/api/auth/refresh',
    '/health',
  ];

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.auth.getAccessToken();
    const lang = this.locale.currentLanguage();

    const shouldSkip = this.skipUrls.some(url =>
      req.url.toLowerCase().includes(url.toLowerCase())
    );

    const headers: Record<string, string> = {
      'Accept-Language': lang,
    };

    if (token && !shouldSkip) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const cloned = req.clone({ setHeaders: headers });
    return next.handle(cloned);
  }
}
