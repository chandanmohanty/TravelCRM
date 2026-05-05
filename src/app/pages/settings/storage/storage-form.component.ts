import {
  Component, ChangeDetectionStrategy, inject, signal, input, OnInit,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { StorageApiService } from 'src/app/core/services/storage-api.service';
import {
  StorageConfigDto,
  StorageConfigRequest,
  StorageDriver,
  DRIVER_LABELS,
} from 'src/app/core/models/storage-config.model';

type Scope = 'tenant' | 'platform';

@Component({
  selector: 'app-storage-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatCheckboxModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">{{ isEdit() ? 'Edit' : 'Add' }} Storage Configuration</h2>
      <p class="text-muted m-0 m-t-4">Configure a new local or cloud storage driver</p>
    </div>

    @if (loadingRecord()) {
      <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
    } @else {

    <div class="form-layout">
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <mat-icon class="text-primary">dns</mat-icon>
            <mat-card-title>{{ isEdit() ? 'Edit' : 'Add' }} Storage Configuration</mat-card-title>
            <span class="spacer"></span>
            <button mat-stroked-button type="button" (click)="goBack()">
              <mat-icon>arrow_back</mat-icon> Back
            </button>
          </div>
          <p class="card-sub">Configure a new local or cloud storage driver</p>
        </mat-card-header>

        <mat-card-content class="p-t-16">
          <form [formGroup]="form" (ngSubmit)="save()">

            <!-- Row 1: Name + Driver + Active -->
            <div class="field-row three-col">
              <mat-form-field appearance="outline">
                <mat-label>Name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Production S3" />
                @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
                  <mat-error>Name is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Driver</mat-label>
                <mat-select formControlName="driver">
                  @for (d of drivers; track d.value) {
                    <mat-option [value]="d.value">{{ d.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <div class="checkbox-wrap">
                <mat-checkbox formControlName="isActive" color="primary">
                  Make this the active storage
                </mat-checkbox>
              </div>
            </div>

            <!-- Driver-specific fields -->
            @switch (form.value.driver) {
              @case (0) {
                <!-- LocalDisk -->
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Base Path</mat-label>
                  <input matInput formControlName="basePath" placeholder="uploads" />
                </mat-form-field>
              }
              @case (1) {
                <!-- Amazon S3 -->
                <div class="field-row">
                  <mat-form-field appearance="outline">
                    <mat-label>AWS Key</mat-label>
                    <input matInput formControlName="awsAccessKey" />
                    @if (form.get('awsAccessKey')?.hasError('required') && form.get('awsAccessKey')?.touched) {
                      <mat-error>Required</mat-error>
                    }
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>AWS Secret</mat-label>
                    <input matInput type="password" formControlName="awsSecretKey" />
                    @if (form.get('awsSecretKey')?.hasError('required') && form.get('awsSecretKey')?.touched) {
                      <mat-error>Required</mat-error>
                    }
                  </mat-form-field>
                </div>
                <div class="field-row three-col">
                  <mat-form-field appearance="outline">
                    <mat-label>Region</mat-label>
                    <input matInput formControlName="awsRegion" placeholder="us-east-1" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Bucket</mat-label>
                    <input matInput formControlName="awsBucket" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Endpoint (optional)</mat-label>
                    <input matInput formControlName="awsEndpoint" placeholder="https://cdn.example.com" />
                  </mat-form-field>
                </div>
              }
              @case (2) {
                <!-- Azure Blob -->
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Connection String</mat-label>
                  <input matInput type="password" formControlName="azureConnectionString" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Container Name</mat-label>
                  <input matInput formControlName="azureContainerName" />
                </mat-form-field>
              }
              @case (3) {
                <!-- Google Cloud Storage -->
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Service Account JSON</mat-label>
                  <textarea matInput formControlName="gcsServiceAccountJson" rows="4"></textarea>
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>GCS Bucket</mat-label>
                  <input matInput formControlName="gcsBucket" />
                </mat-form-field>
              }
            }

            <!-- Actions -->
            <div class="form-actions">
              <button mat-raised-button color="primary" type="submit"
                      [disabled]="form.invalid || saving()">
                @if (saving()) { <mat-spinner diameter="16"></mat-spinner> }
                @else { <mat-icon>save</mat-icon> }
                <span>Save</span>
              </button>
              <button mat-stroked-button type="button" (click)="goBack()">
                <mat-icon>arrow_back</mat-icon> Back
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>

    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .form-layout { max-width: 900px; }
    .card-title-row { display: flex; align-items: center; gap: 10px; width: 100%; }
    .card-title-row .spacer { flex: 1; }
    .card-sub { color: #8695ad; font-size: 12px; margin: 0 0 0 34px; }
    mat-card-content { padding: 16px !important; }

    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field-row.three-col { grid-template-columns: 1fr 1fr auto; }
    .full-width { width: 100%; }
    mat-form-field { width: 100%; }
    .checkbox-wrap { display: flex; align-items: center; padding-top: 8px; }

    .form-actions { display: flex; gap: 12px; margin-top: 16px; }
    .form-actions button { display: inline-flex; align-items: center; gap: 6px; }

    @media (max-width: 720px) {
      .field-row, .field-row.three-col { grid-template-columns: 1fr; }
    }
  `],
})
export class StorageFormComponent implements OnInit {
  readonly scope = input<Scope>('tenant');

  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(StorageApiService);
  private readonly toastr = inject(ToastrService);
  private readonly route  = inject(ActivatedRoute);
  private readonly loc    = inject(Location);

  readonly isEdit        = signal(false);
  readonly loadingRecord = signal(false);
  readonly saving        = signal(false);
  private editId: string | null = null;

  readonly drivers = [
    { value: StorageDriver.AmazonS3,           label: DRIVER_LABELS[StorageDriver.AmazonS3] },
    { value: StorageDriver.LocalDisk,          label: DRIVER_LABELS[StorageDriver.LocalDisk] },
    { value: StorageDriver.AzureBlob,          label: DRIVER_LABELS[StorageDriver.AzureBlob] },
    { value: StorageDriver.GoogleCloudStorage, label: DRIVER_LABELS[StorageDriver.GoogleCloudStorage] },
  ];

  readonly form = this.fb.group({
    name:                  ['', Validators.required],
    driver:                [StorageDriver.AmazonS3 as StorageDriver],
    isActive:              [false],
    basePath:              ['uploads'],
    awsAccessKey:          [''],
    awsSecretKey:          [''],
    awsRegion:             ['us-east-1'],
    awsBucket:             [''],
    awsEndpoint:           [''],
    azureConnectionString: [''],
    azureContainerName:    [''],
    gcsServiceAccountJson: [''],
    gcsBucket:             [''],
  });

  ngOnInit(): void {
    const paramId = this.route.snapshot.paramMap.get('id');
    if (paramId && paramId !== 'new') {
      this.isEdit.set(true);
      this.editId = paramId;
      this.loadRecord(paramId);
    }
  }

  private loadRecord(id: string): void {
    this.loadingRecord.set(true);
    // Load all configs, find the one by id
    const obs$ = this.scope() === 'platform'
      ? this.api.getPlatformConfigs()
      : this.api.getTenantConfigs();

    obs$.subscribe({
      next: (list) => {
        const cfg = list.find(c => c.id === id);
        if (cfg) this.patchForm(cfg);
        this.loadingRecord.set(false);
      },
      error: () => {
        this.toastr.error('Failed to load storage configuration.');
        this.loadingRecord.set(false);
      },
    });
  }

  private patchForm(cfg: StorageConfigDto): void {
    this.form.patchValue({
      name:                  cfg.name,
      driver:                cfg.driver,
      isActive:              cfg.isActive,
      basePath:              cfg.basePath ?? '',
      awsAccessKey:          cfg.awsAccessKey ?? '',
      awsSecretKey:          cfg.awsSecretKey ?? '',
      awsRegion:             cfg.awsRegion ?? '',
      awsBucket:             cfg.awsBucket ?? '',
      awsEndpoint:           cfg.awsEndpoint ?? '',
      azureConnectionString: cfg.azureConnectionString ?? '',
      azureContainerName:    cfg.azureContainerName ?? '',
      gcsServiceAccountJson: cfg.gcsServiceAccountJson ?? '',
      gcsBucket:             cfg.gcsBucket ?? '',
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);

    const body: StorageConfigRequest = {
      name:                  this.form.value.name!,
      driver:                this.form.value.driver!,
      isActive:              this.form.value.isActive!,
      basePath:              this.form.value.basePath || null,
      awsAccessKey:          this.form.value.awsAccessKey || null,
      awsSecretKey:          this.form.value.awsSecretKey || null,
      awsRegion:             this.form.value.awsRegion || null,
      awsBucket:             this.form.value.awsBucket || null,
      awsEndpoint:           this.form.value.awsEndpoint || null,
      azureConnectionString: this.form.value.azureConnectionString || null,
      azureContainerName:    this.form.value.azureContainerName || null,
      gcsServiceAccountJson: this.form.value.gcsServiceAccountJson || null,
      gcsBucket:             this.form.value.gcsBucket || null,
    };

    const obs$ = this.isEdit()
      ? (this.scope() === 'platform'
          ? this.api.updatePlatformConfig(this.editId!, body)
          : this.api.updateTenantConfig(this.editId!, body))
      : (this.scope() === 'platform'
          ? this.api.createPlatformConfig(body)
          : this.api.createTenantConfig(body));

    obs$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toastr.success(this.isEdit() ? 'Configuration updated.' : 'Configuration created.');
        this.goBack();
      },
      error: (err) => {
        this.saving.set(false);
        this.toastr.error(err?.error?.error || 'Failed to save.');
      },
    });
  }

  goBack(): void {
    this.loc.back();
  }
}
