import { APP_INITIALIZER, ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, HttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { EnvelopeInterceptor } from './core/interceptors/envelope.interceptor';
import { Observable } from 'rxjs';
import { routes } from './app.routes';
import { environment } from 'src/environments/environment';
import { API_BASE_URL } from './core/tokens/api-base-url.token';
import { BrandContextService } from './core/services/brand-context.service';
import { AuthService } from './core/services/auth.service';
import { EntitlementsService } from './core/services/entitlements.service';
import { firstValueFrom } from 'rxjs';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideClientHydration } from '@angular/platform-browser';
import { TranslateLoader, TranslateModule, MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { ToastrModule } from 'ngx-toastr';
import { provideToastr } from 'ngx-toastr';

// icons
import { TablerIconsModule } from 'angular-tabler-icons';
import * as TablerIcons from 'angular-tabler-icons/icons';

// perfect scrollbar
import { NgScrollbarModule } from 'ngx-scrollbar';
import { NgxPermissionsModule } from 'ngx-permissions';
//Import all material modules
import { MaterialModule } from './material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';

// code view
import { provideHighlightOptions } from 'ngx-highlightjs';
import 'highlight.js/styles/atom-one-dark.min.css';

export class CustomLoader implements TranslateLoader {
  constructor(private http: HttpClient, private prefix: string, private suffix: string) { }

  getTranslation(lang: string): Observable<any> {
    return this.http.get(`${this.prefix}${lang}${this.suffix}`);
  }
}

export function HttpLoaderFactory(http: HttpClient) {
  return new CustomLoader(http, './assets/i18n/', '.json');
}

export class FallbackMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams) {
    return params.key;
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(), // required animations providers
    provideToastr(), // Toastr providers
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHighlightOptions({
      coreLibraryLoader: () => import('highlight.js/lib/core'),
      lineNumbersLoader: () => import('ngx-highlightjs/line-numbers'), // Optional, add line numbers if needed
      languages: {
        typescript: () => import('highlight.js/lib/languages/typescript'),
        css: () => import('highlight.js/lib/languages/css'),
        xml: () => import('highlight.js/lib/languages/xml'),
      },
    }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
      withComponentInputBinding()
    ),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    // EnvelopeInterceptor unwraps `{success,data}` so services see the bare DTO
    // they were written against. Registered after Auth so the auth token goes on
    // the request untouched; the unwrap only applies on the way back.
    { provide: HTTP_INTERCEPTORS, useClass: EnvelopeInterceptor, multi: true },
    { provide: API_BASE_URL, useValue: environment.apiUrl },
    // Load the resolved brand at bootstrap so the sidebar logo and favicon are
    // correct on the very first render. The initializer always resolves — a
    // backend error falls back to the built-in default rather than blocking.
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [BrandContextService, AuthService],
      useFactory: (brandCtx: BrandContextService, auth: AuthService) =>
        () => auth.isLoggedIn() ? brandCtx.load() : Promise.resolve(),
    },
    // Phase 0 — entitlements bootstrap. On page refresh with a valid token
    // we need the plan + feature codes ready before guards run, so the
    // *hasFeature directive renders correctly on first paint. Always
    // resolves: platform admins have no tenant and the call falls back to
    // "no entitlements" silently.
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [EntitlementsService, AuthService],
      useFactory: (ents: EntitlementsService, auth: AuthService) =>
        () => {
          if (!auth.isLoggedIn() || auth.isPlatformAdmin()) return Promise.resolve();
          return firstValueFrom(ents.load()).catch(() => null);
        },
    },
    provideClientHydration(),
    provideAnimationsAsync(),
    importProvidersFrom(
      FormsModule,
      ToastrModule.forRoot(),
      ReactiveFormsModule,
      MaterialModule,
      NgxPermissionsModule.forRoot(),
      TablerIconsModule.pick(TablerIcons),
      NgScrollbarModule,
      CalendarModule.forRoot({
        provide: DateAdapter,
        useFactory: adapterFactory,
      }),
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient],
        },
        missingTranslationHandler: {
          provide: MissingTranslationHandler,
          useClass: FallbackMissingTranslationHandler,
        },
      })
    ),
  ],
};
