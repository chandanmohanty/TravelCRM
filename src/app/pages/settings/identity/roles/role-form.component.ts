import {
  Component, ChangeDetectionStrategy, inject, signal, computed, OnInit,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { ToastrService } from 'ngx-toastr';
import { IdentityApiService } from 'src/app/core/services/identity-api.service';
import { PermissionDto, RoleWithPermissionsDto } from 'src/app/core/models/identity.model';

type Grouped = { module: string; submodule: string; perms: PermissionDto[] };

@Component({
  selector: 'app-role-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatCheckboxModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatExpansionModule,
  ],
  template: `
    <div class="page-header m-b-24">
      <h2 class="f-s-24 f-w-700 m-0">{{ pageTitle() }}</h2>
      <p class="text-muted m-0 m-t-4">
        @if (role()?.isSystemRole) {
          System role — metadata is read-only. Permission matrix is managed by the platform seeder.
        } @else {
          Configure the role name and grant fine-grained permissions.
        }
      </p>
    </div>

    @if (loadingRecord()) {
      <div class="loading-wrap"><mat-spinner diameter="32"></mat-spinner></div>
    } @else {
    <div class="form-layout">

      <!-- Identity card -->
      <mat-card>
        <mat-card-header>
          <div class="card-title-row">
            <mat-icon class="text-primary">admin_panel_settings</mat-icon>
            <div>
              <mat-card-title>Role details</mat-card-title>
              <p class="card-sub">Name and description</p>
            </div>
            <span class="spacer"></span>
            <button mat-stroked-button type="button" (click)="goBack()">
              <mat-icon>arrow_back</mat-icon> Back
            </button>
          </div>
        </mat-card-header>
        <mat-card-content class="p-t-16">
          <form [formGroup]="form">
            <div class="field-row">
              <mat-form-field appearance="outline">
                <mat-label>Name</mat-label>
                <input matInput formControlName="name" maxlength="100" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Slug</mat-label>
                <input matInput formControlName="slug" readonly />
                <mat-hint>Auto-generated from name.</mat-hint>
              </mat-form-field>
            </div>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description</mat-label>
              <input matInput formControlName="description" maxlength="500" />
            </mat-form-field>

            <div class="form-actions m-t-8">
              <button mat-raised-button color="primary"
                      (click)="saveDetails()"
                      [disabled]="form.invalid || saving() || role()?.isSystemRole">
                @if (saving()) { <mat-spinner diameter="16"></mat-spinner> }
                @else { <mat-icon>save</mat-icon> }
                <span>{{ isEdit() ? 'Save details' : 'Create role' }}</span>
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Permission matrix (only visible on edit + non-system roles) -->
      @if (isEdit() && !role()?.isSystemRole) {
        <mat-card>
          <mat-card-header>
            <div class="card-title-row">
              <mat-icon class="text-primary">lock</mat-icon>
              <div>
                <mat-card-title>Permissions</mat-card-title>
                <p class="card-sub">
                  {{ grantedCount() }} of {{ allPerms().length }} granted
                </p>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content class="p-t-16">
            <mat-accordion [multi]="true">
              @for (g of grouped(); track g.module + g.submodule) {
                <mat-expansion-panel expanded>
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <span class="module-title">{{ g.module }} · {{ g.submodule }}</span>
                    </mat-panel-title>
                    <mat-panel-description>
                      {{ grantedIn(g) }} / {{ g.perms.length }}
                      <button mat-button type="button"
                              class="perm-group-toggle"
                              (click)="toggleGroup(g, $event)">
                        {{ allGranted(g) ? 'Clear' : 'Select all' }}
                      </button>
                    </mat-panel-description>
                  </mat-expansion-panel-header>

                  <div class="perm-grid">
                    @for (p of g.perms; track p.id) {
                      <mat-checkbox
                        [checked]="granted().has(p.id)"
                        (change)="toggle(p.id, $event.checked)">
                        <div>
                          <div class="f-w-600">{{ p.name }}</div>
                          @if (p.description) {
                            <div class="f-s-12 text-muted">{{ p.description }}</div>
                          }
                          <code class="perm-slug">{{ p.slug }}</code>
                        </div>
                      </mat-checkbox>
                    }
                  </div>
                </mat-expansion-panel>
              }
            </mat-accordion>

            <div class="form-actions m-t-16">
              <button mat-raised-button color="primary"
                      (click)="savePermissions()"
                      [disabled]="saving()">
                @if (saving()) { <mat-spinner diameter="16"></mat-spinner> }
                @else { <mat-icon>save</mat-icon> }
                <span>Save permissions</span>
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .loading-wrap { display: flex; justify-content: center; padding: 40px; }
    .form-layout { display: flex; flex-direction: column; gap: 20px; max-width: 1000px; }
    .card-title-row { display: flex; align-items: center; gap: 10px; width: 100%; }
    .card-title-row .spacer { flex: 1; }
    .card-sub { color: #8695ad; font-size: 12px; margin: 0; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .full-width { width: 100%; }
    mat-form-field { width: 100%; }
    .form-actions { display: flex; gap: 12px; }
    .form-actions button { display: inline-flex; align-items: center; gap: 6px; }
    .m-t-8 { margin-top: 8px; }
    .m-t-16 { margin-top: 16px; }
    .module-title { text-transform: capitalize; font-weight: 600; }
    .perm-group-toggle { font-size: 11px !important; margin-left: 12px !important; }
    .perm-grid {
      display: grid; gap: 10px;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      padding: 8px 0;
    }
    .perm-grid mat-checkbox {
      align-items: flex-start; padding: 8px 12px;
      border: 1px solid rgba(0,0,0,.06); border-radius: 6px;
      transition: background .15s;
    }
    .perm-grid mat-checkbox:hover { background: #f7f9fc; }
    .perm-slug {
      display: inline-block; font-family: ui-monospace, monospace;
      font-size: 10px; color: #6b7280;
      background: #f0f3f8; padding: 1px 6px; border-radius: 3px; margin-top: 4px;
    }
    @media (max-width: 720px) { .field-row { grid-template-columns: 1fr; } }
  `],
})
export class RoleFormComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(IdentityApiService);
  private readonly toastr = inject(ToastrService);
  private readonly route  = inject(ActivatedRoute);
  private readonly loc    = inject(Location);

  readonly isEdit        = signal(false);
  readonly loadingRecord = signal(false);
  readonly saving        = signal(false);
  readonly role          = signal<RoleWithPermissionsDto | null>(null);
  readonly allPerms      = signal<PermissionDto[]>([]);
  readonly granted       = signal<Set<string>>(new Set());
  private editId: string | null = null;

  readonly pageTitle = computed(() => this.isEdit() ? 'Edit Role' : 'Add Role');
  readonly grantedCount = computed(() => this.granted().size);

  readonly grouped = computed<Grouped[]>(() => {
    const byKey = new Map<string, Grouped>();
    for (const p of this.allPerms()) {
      const key = `${p.module}/${p.submodule}`;
      if (!byKey.has(key)) byKey.set(key, { module: p.module, submodule: p.submodule, perms: [] });
      byKey.get(key)!.perms.push(p);
    }
    return Array.from(byKey.values())
      .sort((a, b) => a.module.localeCompare(b.module) || a.submodule.localeCompare(b.submodule));
  });

  readonly form = this.fb.group({
    name:        ['', [Validators.required, Validators.maxLength(100)]],
    slug:        [{ value: '', disabled: true }],
    description: [''],
  });

  ngOnInit(): void {
    // Load permission catalog regardless
    this.api.listPermissions().subscribe({
      next: ps => this.allPerms.set(ps),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit.set(true);
      this.editId = id;
      this.loadRole(id);
    }

    // Keep slug preview reactive to name
    this.form.get('name')!.valueChanges.subscribe(v => {
      if (!this.isEdit()) {
        this.form.patchValue({ slug: this.slugify(v ?? '') }, { emitEvent: false });
      }
    });
  }

  private loadRole(id: string): void {
    this.loadingRecord.set(true);
    this.api.getRoleWithPermissions(id).subscribe({
      next: r => {
        this.role.set(r);
        this.form.patchValue({
          name:        r.name,
          slug:        r.slug ?? '',
          description: r.description ?? '',
        });
        this.granted.set(new Set(r.permissionIds));
        if (r.isSystemRole) {
          this.form.get('name')?.disable();
          this.form.get('description')?.disable();
        }
        this.loadingRecord.set(false);
      },
      error: err => {
        this.toastr.error(err?.error?.error || 'Failed to load role.');
        this.loadingRecord.set(false);
      },
    });
  }

  toggle(permId: string, checked: boolean): void {
    const next = new Set(this.granted());
    if (checked) next.add(permId); else next.delete(permId);
    this.granted.set(next);
  }

  allGranted(g: Grouped): boolean {
    const s = this.granted();
    return g.perms.every(p => s.has(p.id));
  }

  grantedIn(g: Grouped): number {
    const s = this.granted();
    return g.perms.filter(p => s.has(p.id)).length;
  }

  toggleGroup(g: Grouped, ev: Event): void {
    ev.stopPropagation(); ev.preventDefault();
    const next = new Set(this.granted());
    if (this.allGranted(g)) {
      g.perms.forEach(p => next.delete(p.id));
    } else {
      g.perms.forEach(p => next.add(p.id));
    }
    this.granted.set(next);
  }

  saveDetails(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();

    if (this.isEdit()) {
      this.api.updateRole(this.editId!, { name: v.name!, description: v.description || null }).subscribe({
        next: () => { this.toastr.success('Role updated.'); this.saving.set(false); },
        error: err => { this.toastr.error(err?.error?.error || 'Failed.'); this.saving.set(false); },
      });
    } else {
      this.api.createRole({ name: v.name!, description: v.description || null }).subscribe({
        next: r => {
          this.toastr.success('Role created. You can now assign permissions.');
          this.saving.set(false);
          this.loc.go(`/settings/identity/roles/${r.id}`);
          // Re-init in edit mode so permission matrix becomes visible
          this.isEdit.set(true);
          this.editId = r.id;
          this.role.set({ ...r, permissionIds: [] });
        },
        error: err => { this.toastr.error(err?.error?.error || 'Failed.'); this.saving.set(false); },
      });
    }
  }

  savePermissions(): void {
    if (!this.editId) return;
    this.saving.set(true);
    this.api.assignPermissionsToRole(this.editId, {
      permissionIds: Array.from(this.granted()),
    }).subscribe({
      next: () => { this.toastr.success('Permissions updated.'); this.saving.set(false); },
      error: err => { this.toastr.error(err?.error?.error || 'Failed.'); this.saving.set(false); },
    });
  }

  goBack(): void { this.loc.back(); }

  private slugify(s: string): string {
    return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'role';
  }
}
