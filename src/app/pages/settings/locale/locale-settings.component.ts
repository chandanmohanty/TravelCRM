import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { LocaleService } from '../../../core/services/locale.service';

interface TimezoneOption {
  id: string;
  label: string;
}

interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

@Component({
  selector: 'app-locale-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatSelectModule,
    MatSnackBarModule, MatDividerModule, TablerIconsModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">{{ 'SETTINGS.LANGUAGE' | translate }} & {{ 'SETTINGS.TIMEZONE' | translate }}</h2>
      <p class="text-muted m-0 m-t-4">Configure your language, timezone, and currency preferences.</p>
    </div>

    <div class="row">
      <div class="col-lg-8">
        <mat-card class="cardWithShadow">
          <mat-card-content class="p-24">
            <mat-card-title class="m-b-4">Locale Preferences</mat-card-title>
            <mat-card-subtitle class="f-s-14 m-b-24">
              Changes take effect immediately. Your preferences are saved automatically.
            </mat-card-subtitle>

            <form [formGroup]="form">
              <!-- Language -->
              <div class="row m-b-16">
                <div class="col-sm-4 d-flex align-items-center">
                  <div class="d-flex align-items-center gap-8">
                    <i-tabler name="language" class="icon-20 text-primary"></i-tabler>
                    <span class="f-s-14 f-w-600">{{ 'SETTINGS.LANGUAGE' | translate }}</span>
                  </div>
                </div>
                <div class="col-sm-8">
                  <mat-form-field appearance="outline" class="w-100">
                    <mat-select formControlName="language" (selectionChange)="onLanguageChange($event.value)">
                      @for (lang of locale.supportedLanguages; track lang.code) {
                        <mat-option [value]="lang.code">
                          <div class="d-flex align-items-center gap-8">
                            <img [src]="lang.icon" width="20" height="14" [alt]="lang.label" style="border-radius: 2px;">
                            <span>{{ lang.label }}</span>
                            @if (lang.dir === 'rtl') {
                              <span class="f-s-10 text-muted">(RTL)</span>
                            }
                          </div>
                        </mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>

              <mat-divider class="m-b-16"></mat-divider>

              <!-- Timezone -->
              <div class="row m-b-16">
                <div class="col-sm-4 d-flex align-items-center">
                  <div class="d-flex align-items-center gap-8">
                    <i-tabler name="clock" class="icon-20 text-primary"></i-tabler>
                    <span class="f-s-14 f-w-600">{{ 'SETTINGS.TIMEZONE' | translate }}</span>
                  </div>
                </div>
                <div class="col-sm-8">
                  <mat-form-field appearance="outline" class="w-100">
                    <mat-select formControlName="timezone" (selectionChange)="onTimezoneChange($event.value)">
                      @for (tz of timezones; track tz.id) {
                        <mat-option [value]="tz.id">{{ tz.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>

              <mat-divider class="m-b-16"></mat-divider>

              <!-- Currency -->
              <div class="row m-b-16">
                <div class="col-sm-4 d-flex align-items-center">
                  <div class="d-flex align-items-center gap-8">
                    <i-tabler name="currency-dollar" class="icon-20 text-primary"></i-tabler>
                    <span class="f-s-14 f-w-600">{{ 'SETTINGS.CURRENCY' | translate }}</span>
                  </div>
                </div>
                <div class="col-sm-8">
                  <mat-form-field appearance="outline" class="w-100">
                    <mat-select formControlName="currency" (selectionChange)="onCurrencyChange($event.value)">
                      @for (curr of currencies; track curr.code) {
                        <mat-option [value]="curr.code">
                          {{ curr.symbol }} {{ curr.name }} ({{ curr.code }})
                        </mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>
            </form>

            <mat-divider class="m-b-16"></mat-divider>

            <!-- Preview -->
            <div class="preview-section">
              <h6 class="f-s-14 f-w-600 m-b-12">Live Preview</h6>
              <div class="row">
                <div class="col-sm-4">
                  <div class="preview-item">
                    <span class="f-s-12 text-muted d-block">Date & Time</span>
                    <span class="f-s-14 f-w-600">{{ previewDate() }}</span>
                  </div>
                </div>
                <div class="col-sm-4">
                  <div class="preview-item">
                    <span class="f-s-12 text-muted d-block">Currency</span>
                    <span class="f-s-14 f-w-600">{{ previewCurrency() }}</span>
                  </div>
                </div>
                <div class="col-sm-4">
                  <div class="preview-item">
                    <span class="f-s-12 text-muted d-block">Direction</span>
                    <span class="f-s-14 f-w-600">{{ locale.currentDirection() | uppercase }}</span>
                  </div>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Info Card -->
      <div class="col-lg-4">
        <mat-card class="cardWithShadow">
          <mat-card-content class="p-24">
            <div class="d-flex align-items-center m-b-16">
              <i-tabler name="info-circle" class="icon-24 text-primary m-r-8"></i-tabler>
              <span class="f-s-16 f-w-600">About Localization</span>
            </div>
            <p class="f-s-13 text-muted m-b-12">
              Language changes are applied instantly across the entire application without requiring a page reload.
            </p>
            <p class="f-s-13 text-muted m-b-12">
              Timezone settings affect how dates and times are displayed throughout the CRM.
            </p>
            <p class="f-s-13 text-muted m-b-0">
              Currency formatting is used in leads, invoices, and financial reports.
            </p>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .gap-8 { gap: 8px; }
    .preview-section {
      background: #f5f7fa;
      border-radius: 12px;
      padding: 16px;
    }
    .preview-item {
      padding: 8px 0;
    }
  `],
})
export class LocaleSettingsComponent implements OnInit {
  readonly locale = inject(LocaleService);
  private fb      = inject(FormBuilder);
  private snack   = inject(MatSnackBar);
  private http    = inject(HttpClient);

  form = this.fb.group({
    language: ['en'],
    timezone: ['Asia/Kolkata'],
    currency: ['INR'],
  });

  timezones: TimezoneOption[] = [
    { id: 'Asia/Kolkata',      label: '(UTC+05:30) India Standard Time' },
    { id: 'Asia/Dubai',        label: '(UTC+04:00) Gulf Standard Time' },
    { id: 'UTC',               label: '(UTC+00:00) Coordinated Universal Time' },
    { id: 'America/New_York',  label: '(UTC-05:00) Eastern Time' },
    { id: 'Europe/London',     label: '(UTC+00:00) Greenwich Mean Time' },
    { id: 'Asia/Tokyo',        label: '(UTC+09:00) Japan Standard Time' },
    { id: 'Australia/Sydney',  label: '(UTC+11:00) Australian Eastern Time' },
    { id: 'Asia/Singapore',    label: '(UTC+08:00) Singapore Time' },
    { id: 'Europe/Berlin',     label: '(UTC+01:00) Central European Time' },
    { id: 'America/Los_Angeles', label: '(UTC-08:00) Pacific Time' },
  ];

  currencies: CurrencyOption[] = [
    { code: 'INR', name: 'Indian Rupee',   symbol: '₹' },
    { code: 'AED', name: 'UAE Dirham',     symbol: 'د.إ' },
    { code: 'USD', name: 'US Dollar',      symbol: '$' },
    { code: 'EUR', name: 'Euro',           symbol: '€' },
    { code: 'GBP', name: 'British Pound',  symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen',   symbol: '¥' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  ];

  previewDate  = signal('');
  previewCurrency = signal('');

  ngOnInit(): void {
    this.form.patchValue({
      language: this.locale.currentLanguage(),
      timezone: this.locale.currentTimezone(),
      currency: this.locale.currentCurrency(),
    });
    this.updatePreviews();
  }

  onLanguageChange(code: string): void {
    this.locale.setLanguage(code);
    this.updatePreviews();
    this.saveToServer();
    this.snack.open('Language updated', 'OK', { duration: 2000 });
  }

  onTimezoneChange(tz: string): void {
    this.locale.setTimezone(tz);
    this.updatePreviews();
    this.saveToServer();
    this.snack.open('Timezone updated', 'OK', { duration: 2000 });
  }

  onCurrencyChange(currency: string): void {
    this.locale.setCurrency(currency);
    this.updatePreviews();
    this.saveToServer();
    this.snack.open('Currency updated', 'OK', { duration: 2000 });
  }

  private updatePreviews(): void {
    const lang = this.locale.currentLanguage();
    const tz   = this.locale.currentTimezone();
    const curr = this.locale.currentCurrency();

    try {
      this.previewDate.set(
        new Intl.DateTimeFormat(lang, {
          timeZone: tz,
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }).format(new Date())
      );
    } catch {
      this.previewDate.set(new Date().toLocaleString());
    }

    try {
      this.previewCurrency.set(
        new Intl.NumberFormat(lang, {
          style: 'currency',
          currency: curr,
        }).format(98450)
      );
    } catch {
      this.previewCurrency.set('$98,450.00');
    }
  }

  private saveToServer(): void {
    this.http.put('http://localhost:5044/api/locale/user', {
      language: this.locale.currentLanguage(),
      timeZone: this.locale.currentTimezone(),
      currencyCode: this.locale.currentCurrency(),
    }).subscribe({
      error: () => {
        // Server save failed — localStorage still persists locally
      },
    });
  }
}
