import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';

@Component({
  selector: 'app-invoice-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule,
    MatSnackBarModule, MatDividerModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">Invoice Settings</h2>
      <p class="text-muted m-0 m-t-4">Invoice numbering, GST details, and default payment terms.</p>
    </div>

    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-card class="cardWithShadow m-b-24">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16">Numbering</mat-card-title>
          <div class="row">
            <div class="col-md-8 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Numbering template</mat-label>
                <input matInput formControlName="numberingTemplate" placeholder="INV/{FY}/{SEQ:0000}" />
                <mat-hint>Tokens: <code>{{ '{YYYY}' }}</code> <code>{{ '{YY}' }}</code>
                  <code>{{ '{MM}' }}</code> <code>{{ '{FY}' }}</code>
                  <code>{{ '{SEQ}' }}</code> / <code>{{ '{SEQ:0000}' }}</code></mat-hint>
              </mat-form-field>
            </div>
            <div class="col-md-4 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Next sequence</mat-label>
                <input matInput [value]="nextSequence()" readonly />
                <mat-hint>Read-only; increments with each invoice.</mat-hint>
              </mat-form-field>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="cardWithShadow m-b-24">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16">GST (India)</mat-card-title>
          <div class="row">
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>GSTIN</mat-label>
                <input matInput formControlName="gstNumber" maxlength="20" />
              </mat-form-field>
            </div>
            <div class="col-md-6 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Legal name</mat-label>
                <input matInput formControlName="gstLegalName" maxlength="200" />
              </mat-form-field>
            </div>
            <div class="col-md-9 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>Registered address</mat-label>
                <textarea matInput rows="2" formControlName="gstAddress" maxlength="500"></textarea>
              </mat-form-field>
            </div>
            <div class="col-md-3 m-b-16">
              <mat-form-field appearance="outline" class="w-100">
                <mat-label>State code</mat-label>
                <input matInput formControlName="gstStateCode" maxlength="5" />
              </mat-form-field>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="cardWithShadow">
        <mat-card-content class="p-24">
          <mat-card-title class="m-b-16">Defaults</mat-card-title>
          <mat-form-field appearance="outline" class="w-100 m-b-16">
            <mat-label>Default terms</mat-label>
            <input matInput formControlName="defaultTerms" placeholder="Net 30" maxlength="500" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Default notes / footer</mat-label>
            <textarea matInput rows="3" formControlName="defaultNotes" maxlength="2000"></textarea>
          </mat-form-field>

          <mat-divider class="m-y-16"></mat-divider>
          <div class="d-flex justify-content-end gap-8">
            <button mat-stroked-button type="button" (click)="load()" [disabled]="saving()">
              <mat-icon>refresh</mat-icon> Reload
            </button>
            <button mat-flat-button color="primary" type="submit"
                    [disabled]="form.invalid || saving()">
              <mat-icon>save</mat-icon> {{ saving() ? 'Saving…' : 'Save Changes' }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </form>
  `,
})
export class InvoiceSettingsComponent implements OnInit {
  private readonly fb    = inject(FormBuilder);
  private readonly api   = inject(TenantSettingsService);
  private readonly snack = inject(MatSnackBar);

  readonly saving       = signal(false);
  readonly nextSequence = signal<number>(1);

  form = this.fb.group({
    numberingTemplate: ['INV/{FY}/{SEQ:0000}', [Validators.required, Validators.maxLength(100)]],
    gstNumber:         ['', Validators.maxLength(20)],
    gstLegalName:      ['', Validators.maxLength(200)],
    gstAddress:        ['', Validators.maxLength(500)],
    gstStateCode:      ['', Validators.maxLength(5)],
    defaultTerms:      ['', Validators.maxLength(500)],
    defaultNotes:      ['', Validators.maxLength(2000)],
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getInvoice().subscribe({
      next: s => {
        this.nextSequence.set(s.nextSequence);
        this.form.patchValue(s);
      },
      error: () => this.snack.open('Failed to load invoice settings.', 'Close', { duration: 3000 }),
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.api.saveInvoice(this.form.getRawValue() as any).subscribe({
      next: s => {
        this.nextSequence.set(s.nextSequence);
        this.saving.set(false);
        this.snack.open('Invoice settings saved.', 'Close', { duration: 2500 });
      },
      error: err => {
        this.saving.set(false);
        this.snack.open(err?.error?.error ?? 'Save failed.', 'Close', { duration: 3500 });
      },
    });
  }
}
