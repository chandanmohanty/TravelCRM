import { Injectable, signal } from '@angular/core';
import { AppSettings, defaults } from '../config';

const THEME_STORAGE_KEY = 'crm_theme_settings';

@Injectable({
  providedIn: 'root',
})
export class CoreService {
  private optionsSignal = signal<AppSettings>({
    ...defaults,
    ...this.loadFromStorage(),
  });

  /**
   * Reactive accessor for the current app settings. Consumers should prefer
   * this over `getOptions()` so they re-render when the theme changes.
   */
  readonly options = this.optionsSignal.asReadonly();

  getOptions() {
    return this.optionsSignal();
  }

  setOptions(options: Partial<AppSettings>) {
    this.optionsSignal.update((current) => ({
      ...current,
      ...options,
    }));
    this.persist();
    this.applyThemeToDOM();
  }

  setLanguage(lang: string) {
    this.setOptions({ language: lang });
  }

  getLanguage() {
    return this.getOptions().language;
  }

  /** Apply the current theme settings (dark/light + color) to the HTML element. */
  applyThemeToDOM(): void {
    const opts = this.optionsSignal();
    const html = document.documentElement;

    // Dark / Light mode
    html.classList.toggle('dark-theme', opts.theme === 'dark');
    html.classList.toggle('light-theme', opts.theme !== 'dark');

    // Color theme — remove all *_theme classes except dark-theme/light-theme, then add active
    const toRemove: string[] = [];
    html.classList.forEach(cls => {
      if (cls.endsWith('_theme') && cls !== 'dark-theme' && cls !== 'light-theme') {
        toRemove.push(cls);
      }
    });
    toRemove.forEach(cls => html.classList.remove(cls));
    html.classList.add(opts.activeTheme);
  }

  private persist(): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(this.optionsSignal()));
    } catch { /* quota exceeded — ignore */ }
  }

  private loadFromStorage(): Partial<AppSettings> {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}
