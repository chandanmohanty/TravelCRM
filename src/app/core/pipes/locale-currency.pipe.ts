import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService } from '../services/locale.service';

/**
 * Locale-aware currency formatting pipe.
 * Uses the user's preferred language and currency from LocaleService.
 *
 * Usage:
 *   {{ amount | localeCurrency }}             — uses tenant/user currency
 *   {{ amount | localeCurrency:'USD' }}       — override currency code
 *   {{ amount | localeCurrency:'INR':'symbol' }}  — with display style
 */
@Pipe({
  name: 'localeCurrency',
  standalone: true,
  pure: false,
})
export class LocaleCurrencyPipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(
    value: number | string | null | undefined,
    currencyCode?: string,
    display: 'symbol' | 'code' | 'name' | 'narrowSymbol' = 'symbol',
  ): string {
    if (value == null) return '';

    const amount = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(amount)) return String(value);

    const lang     = this.locale.currentLanguage();
    const currency = currencyCode ?? this.locale.currentCurrency();

    try {
      return new Intl.NumberFormat(lang, {
        style: 'currency',
        currency,
        currencyDisplay: display,
      }).format(amount);
    } catch {
      // Fallback
      return new Intl.NumberFormat('en', {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: display,
      }).format(amount);
    }
  }
}
