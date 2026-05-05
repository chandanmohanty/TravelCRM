import {
  Component, ChangeDetectionStrategy, inject, signal, OnInit,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastrService } from 'ngx-toastr';
import { IdentityApiService } from 'src/app/core/services/identity-api.service';
import {
  CreateUserRequest,
  DepartmentDto,
  RoleDto,
  UpdateUserRequest,
  UserDto,
} from 'src/app/core/models/identity.model';

@Component({
  selector: 'app-user-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatButtonModule, MatIconModule,
    MatSlideToggleModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">{{ isEdit() ? 'Edit User' : 'Invite / Add User' }}</h2>
      <p class="text-muted m-0 m-t-4">
        {{ isEdit() ? 'Update user details and role.' : 'Create a new user in your tenant.' }}
      </p>
    </div>

    @if (loadingRecord()) {
      <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
    } @else {

    <div class="form-layout">
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <mat-icon class="text-primary">person</mat-icon>
            <div>
              <mat-card-title>{{ isEdit() ? 'User' : 'New User' }}</mat-card-title>
              <p class="card-sub">{{ isEdit() ? 'Identity' : 'Identity & initial role' }}</p>
            </div>
            <span class="spacer"></span>
            <button mat-stroked-button type="button" (click)="goBack()">
              <mat-icon>arrow_back</mat-icon> Back
            </button>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <form [formGroup]="form">

            @if (!isEdit()) {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Email</mat-label>
                <input matInput formControlName="email" type="email" autocomplete="off" />
              </mat-form-field>
            } @else {
              <div class="readonly-row">
                <div>
                  <span class="readonly-label">Email</span>
                  <div>{{ existing()?.email }}</div>
                </div>
                <div>
                  <span class="readonly-label">Employee ID</span>
                  <div><code class="code-chip">{{ existing()?.employeeId || '—' }}</code></div>
                </div>
              </div>
            }

            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>First name</mat-label>
                <input matInput formControlName="firstName" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Last name</mat-label>
                <input matInput formControlName="lastName" />
              </mat-form-field>
            </div>

            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>Phone</mat-label>
                <input matInput formControlName="phone" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Job title</mat-label>
                <input matInput formControlName="jobTitle" />
              </mat-form-field>
            </div>

            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>Role</mat-label>
                <mat-select formControlName="roleId">
                  @for (r of roles(); track r.id) {
                    <mat-option [value]="r.id">{{ r.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Department</mat-label>
                <mat-select formControlName="departmentId">
                  <mat-option [value]="null">— none —</mat-option>
                  @for (d of departments(); track d.id) {
                    <mat-option [value]="d.id">{{ d.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>

            @if (!isEdit()) {
              <div class="invite-row">
                <mat-slide-toggle formControlName="sendInvite" color="primary">
                  Send email invitation (user sets their own password via a 7-day link)
                </mat-slide-toggle>
                @if (!form.value.sendInvite) {
                  <mat-form-field appearance="outline" class="full-width m-t-12">
                    <mat-label>Initial password</mat-label>
                    <input matInput type="password" formControlName="password" autocomplete="new-password" />
                    <mat-hint>Min 8 chars with uppercase, lowercase, and a digit.</mat-hint>
                  </mat-form-field>
                }
              </div>
            }

            <div class="form-actions">
              <button mat-raised-button color="primary" (click)="save()"
                      [disabled]="form.invalid || saving()">
                @if (saving()) { <mat-spinner diameter="16"></mat-spinner> }
                @else { <mat-icon>save</mat-icon> }
                <span>{{ isEdit() ? 'Save changes' : 'Create user' }}</span>
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
    .form-layout { max-width: 860px; }
    .card-title-row { display: flex; align-items: center; gap: 10px; width: 100%; }
    .card-title-row .spacer { flex: 1; }
    .card-sub { color: #8695ad; font-size: 12px; margin: 0; }
    mat-card-content { padding: 16px !important; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .full-width { width: 100%; }
    mat-form-field { width: 100%; }
    .m-t-12 { margin-top: 12px; }
    .readonly-row { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; background: #f4f6fa; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
    .readonly-label { font-size: 11px; text-transform: uppercase; color: #8695ad; font-weight: 600; letter-spacing: 0.3px; }
    .code-chip { font-family: ui-monospace, monospace; font-size: 12px; }
    .invite-row { padding: 8px 0 16px; }
    .form-actions { display: flex; gap: 12px; margin-top: 16px; }
    .form-actions button { display: inline-flex; align-items: center; gap: 6px; }
    @media (max-width: 720px) { .field-row, .readonly-row { grid-template-columns: 1fr; } }
  `],
})
export class UserFormComponent implements OnInit {
  private readonly fb    = inject(FormBuilder);
  private readonly api   = inject(IdentityApiService);
  private readonly toastr = inject(ToastrService);
  private readonly route = inject(ActivatedRoute);
  private readonly loc   = inject(Location);

  readonly isEdit = signal(false);
  readonly loadingRecord = signal(false);
  readonly saving  = signal(false);
  readonly roles   = signal<RoleDto[]>([]);
  readonly departments = signal<DepartmentDto[]>([]);
  readonly existing = signal<UserDto | null>(null);
  private editId: string | null = null;

  readonly form = this.fb.group({
    email:        ['', [Validators.required, Validators.email]],
    firstName:    ['', Validators.required],
    lastName:     ['', Validators.required],
    phone:        [''],
    jobTitle:     [''],
    roleId:       ['', Validators.required],
    departmentId: [null as string | null],
    sendInvite:   [true],
    password:     [''],
  });

  ngOnInit(): void {
    // Load lookup data
    this.api.listRoles().subscribe({ next: r => this.roles.set(r) });
    this.api.listDepartments().subscribe({ next: d => this.departments.set(d) });

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit.set(true);
      this.editId = id;
      this.loadUser(id);
      this.form.get('email')?.disable();
      this.form.get('sendInvite')?.disable();
      this.form.get('password')?.disable();
    }
  }

  private loadUser(id: string): void {
    this.loadingRecord.set(true);
    this.api.getUser(id).subscribe({
      next: u => {
        this.existing.set(u);
        this.form.patchValue({
          email:        u.email,
          firstName:    u.firstName,
          lastName:     u.lastName,
          phone:        u.phone ?? '',
          jobTitle:     u.jobTitle ?? '',
          roleId:       u.roles[0]?.id ?? '',
          departmentId: u.departmentId ?? null,
        });
        this.loadingRecord.set(false);
      },
      error: err => {
        this.toastr.error(err?.error?.error || 'Failed to load user.');
        this.loadingRecord.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();

    if (this.isEdit()) {
      const body: UpdateUserRequest = {
        firstName:    v.firstName!,
        lastName:     v.lastName!,
        phone:        v.phone || null,
        jobTitle:     v.jobTitle || null,
        roleId:       v.roleId!,
        departmentId: v.departmentId ?? null,
      };
      this.api.updateUser(this.editId!, body).subscribe({
        next: () => { this.toastr.success('User updated.'); this.saving.set(false); this.goBack(); },
        error: err => { this.toastr.error(err?.error?.error || 'Save failed.'); this.saving.set(false); },
      });
    } else {
      const body: CreateUserRequest = {
        email:        v.email!,
        firstName:    v.firstName!,
        lastName:     v.lastName!,
        phone:        v.phone || null,
        jobTitle:     v.jobTitle || null,
        roleId:       v.roleId!,
        departmentId: v.departmentId ?? null,
        sendInvite:   v.sendInvite!,
        password:     v.sendInvite ? null : (v.password || null),
      };
      this.api.createUser(body).subscribe({
        next: () => {
          this.toastr.success(v.sendInvite
            ? 'User invited — a setup email has been sent.'
            : 'User created.');
          this.saving.set(false);
          this.goBack();
        },
        error: err => { this.toastr.error(err?.error?.error || 'Create failed.'); this.saving.set(false); },
      });
    }
  }

  goBack(): void { this.loc.back(); }
}
