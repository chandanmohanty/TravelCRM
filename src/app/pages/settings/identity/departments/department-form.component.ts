import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { IdentityApiService } from 'src/app/core/services/identity-api.service';
import { UserDto } from 'src/app/core/models/identity.model';

@Component({
  selector: 'app-department-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">{{ isEdit() ? 'Edit Department' : 'Add Department' }}</h2>
      <p class="text-muted m-0 m-t-4">Name, description and optional manager.</p>
    </div>

    @if (loadingRecord()) {
      <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
    } @else {
    <div class="form-layout">
      <mat-card>
        <mat-card-content class="p-t-16">
          <form [formGroup]="form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Name</mat-label>
              <input matInput formControlName="name" maxlength="200" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description</mat-label>
              <input matInput formControlName="description" maxlength="500" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Manager</mat-label>
              <mat-select formControlName="managerId">
                <mat-option [value]="null">— none —</mat-option>
                @for (u of users(); track u.id) {
                  <mat-option [value]="u.id">{{ u.fullName }} ({{ u.email }})</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="form-actions m-t-8">
              <button mat-raised-button color="primary" (click)="save()"
                      [disabled]="form.invalid || saving()">
                @if (saving()) { <mat-spinner diameter="16"></mat-spinner> }
                @else { <mat-icon>save</mat-icon> }
                <span>{{ isEdit() ? 'Save' : 'Create' }}</span>
              </button>
              <button mat-stroked-button type="button" (click)="goBack()">Cancel</button>
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
    .form-layout { max-width: 720px; }
    mat-card-content { padding: 16px !important; }
    .full-width { width: 100%; }
    mat-form-field { width: 100%; }
    .form-actions { display: flex; gap: 12px; }
    .form-actions button { display: inline-flex; align-items: center; gap: 6px; }
    .m-t-8 { margin-top: 8px; }
  `],
})
export class DepartmentFormComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(IdentityApiService);
  private readonly toastr = inject(ToastrService);
  private readonly route  = inject(ActivatedRoute);
  private readonly loc    = inject(Location);

  readonly isEdit        = signal(false);
  readonly loadingRecord = signal(false);
  readonly saving        = signal(false);
  readonly users         = signal<UserDto[]>([]);
  private editId: string | null = null;

  readonly form = this.fb.group({
    name:        ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    managerId:   [null as string | null],
  });

  ngOnInit(): void {
    this.api.listUsers({ pageSize: 200 }).subscribe({
      next: r => this.users.set(r.items),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit.set(true);
      this.editId = id;
      this.loadingRecord.set(true);
      this.api.listDepartments().subscribe({
        next: ds => {
          const d = ds.find(x => x.id === id);
          if (d) {
            this.form.patchValue({
              name: d.name, description: d.description ?? '', managerId: d.managerId,
            });
          }
          this.loadingRecord.set(false);
        },
        error: () => this.loadingRecord.set(false),
      });
    }
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body = {
      name: v.name!,
      description: v.description || null,
      managerId: v.managerId ?? null,
    };

    const obs = this.isEdit()
      ? this.api.updateDepartment(this.editId!, body)
      : this.api.createDepartment(body);

    obs.subscribe({
      next: () => {
        this.toastr.success(this.isEdit() ? 'Department updated.' : 'Department created.');
        this.saving.set(false);
        this.goBack();
      },
      error: err => { this.toastr.error(err?.error?.error || 'Failed.'); this.saving.set(false); },
    });
  }

  goBack(): void { this.loc.back(); }
}
