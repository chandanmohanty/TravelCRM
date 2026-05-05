import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CoreService } from '../../services/core.service';

export interface LanguageOption {
  code: string;
  label: string;
  icon: string;
  dir: 'ltr' | 'rtl';
}

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly translate = inject(TranslateService);
  private readonly coreService = inject(CoreService);

  readonly currentLanguage = signal<string>('en');
  readonly currentDirection = signal<'ltr' | 'rtl'>('ltr');
  readonly currentTimezone = signal<string>('Asia/Kolkata');
  readonly currentCurrency = signal<string>('INR');

  private readonly rtlLanguages = ['ar-AE', 'ar', 'he', 'fa', 'ur'];

  readonly supportedLanguages: LanguageOption[] = [
    { code: 'en',    label: 'English',          icon: '/assets/images/flag/icon-flag-en.svg', dir: 'ltr' },
    { code: 'en-IN', label: 'English (India)',   icon: '/assets/images/flag/icon-flag-in.svg', dir: 'ltr' },
    { code: 'hi-IN', label: '\u0939\u093f\u0928\u094d\u0926\u0940',            icon: '/assets/images/flag/icon-flag-in.svg', dir: 'ltr' },
    { code: 'ar-AE', label: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',           icon: '/assets/images/flag/icon-flag-ar.svg', dir: 'rtl' },
    { code: 'es',    label: 'Espa\u00f1ol',           icon: '/assets/images/flag/icon-flag-es.svg', dir: 'ltr' },
    { code: 'fr',    label: 'Fran\u00e7ais',          icon: '/assets/images/flag/icon-flag-fr.svg', dir: 'ltr' },
    { code: 'de',    label: 'Deutsch',           icon: '/assets/images/flag/icon-flag-de.svg', dir: 'ltr' },
  ];

  init(): void {
    this.translate.setDefaultLang('en');
    const saved = this.loadFromStorage();
    this.setLanguage(saved?.language ?? 'en');
    if (saved?.timezone) this.currentTimezone.set(saved.timezone);
    if (saved?.currency) this.currentCurrency.set(saved.currency);
  }

  setLanguage(code: string): void {
    const lang = this.supportedLanguages.find(l => l.code === code);
    if (!lang) return;

    this.currentLanguage.set(code);
    this.translate.use(code);

    const dir = this.rtlLanguages.some(r => code.startsWith(r)) ? 'rtl' : 'ltr';
    this.currentDirection.set(dir);
    document.documentElement.dir = dir;
    document.documentElement.lang = code;

    // Update CoreService direction for layout
    const opts = this.coreService.getOptions();
    this.coreService.setOptions({ ...opts, dir: dir });

    this.persistToStorage();
  }

  setTimezone(tz: string): void {
    this.currentTimezone.set(tz);
    this.persistToStorage();
  }

  setCurrency(currency: string): void {
    this.currentCurrency.set(currency);
    this.persistToStorage();
  }

  initFromLoginResponse(res: { preferredLanguage?: string; timeZone?: string; currencyCode?: string }): void {
    if (res.preferredLanguage) this.setLanguage(res.preferredLanguage);
    if (res.timeZone) this.setTimezone(res.timeZone);
    if (res.currencyCode) this.setCurrency(res.currencyCode);
  }

  getSelectedLanguage(): LanguageOption {
    return this.supportedLanguages.find(l => l.code === this.currentLanguage())
           ?? this.supportedLanguages[0];
  }

  private persistToStorage(): void {
    localStorage.setItem('crm_locale', JSON.stringify({
      language: this.currentLanguage(),
      timezone: this.currentTimezone(),
      currency: this.currentCurrency(),
    }));
  }

  private loadFromStorage(): { language?: string; timezone?: string; currency?: string } | null {
    try {
      const raw = localStorage.getItem('crm_locale');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}
