import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService } from '../services/locale.service';

/**
 * Locale-aware date formatting pipe.
 * Uses the user's preferred language and timezone from LocaleService.
 *
 * Usage:
 *   {{ dateValue | localeDate }}                    — default medium format
 *   {{ dateValue | localeDate:'short' }}            — short format
 *   {{ dateValue | localeDate:'long' }}             — long format
 *   {{ dateValue | localeDate:'date' }}             — date only
 *   {{ dateValue | localeDate:'time' }}             — time only
 */
@Pipe({
  name: 'localeDate',
  standalone: true,
  pure: false,
})
export class LocaleDatePipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(value: string | Date | null | undefined, format: string = 'medium'): string {
    if (!value) return '';

    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return String(value);

    const lang = this.locale.currentLanguage();
    const tz   = this.locale.currentTimezone();

    const options = this.getOptions(format, tz);

    try {
      return new Intl.DateTimeFormat(lang, options).format(date);
    } catch {
      // Fallback if language/timezone not supported
      return new Intl.DateTimeFormat('en', options).format(date);
    }
  }

  private getOptions(format: string, timeZone: string): Intl.DateTimeFormatOptions {
    switch (format) {
      case 'short':
        return { timeZone, year: '2-digit', month: 'numeric', day: 'numeric' };
      case 'long':
        return { timeZone, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
      case 'date':
        return { timeZone, year: 'numeric', month: 'short', day: 'numeric' };
      case 'time':
        return { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit' };
      case 'datetime':
        return { timeZone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      case 'medium':
      default:
        return { timeZone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    }
  }
}
