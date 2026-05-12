import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TablerIconsModule } from 'angular-tabler-icons';
import {
  SIDE_PANEL_DATA,
  SidePanelRef,
} from 'src/app/shared/side-panel';

/**
 * Toy form used by the side-panel demo page. Exists solely to exercise
 * the imperative `SidePanelService.open` path with a dirty-changes guard
 * and a typed `afterClosed()` result — no backend, no real data.
 */
export interface DemoFormResult {
  status: 'saved' | 'cancelled';
  values?: { name: string; email: string; role: string };
}

@Component({
  selector: 'app-demo-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TablerIconsModule,
  ],
  template: `
    <form [formGroup]="form" class="demo-form" (ngSubmit)="save()">
      <p class="hint">
        Toy form. Edit a field and try to close the panel via Esc, the X button,
        or the backdrop — you'll get a "Discard changes?" prompt because the
        form is bound to <code>SidePanelRef.setDirty()</code>.
      </p>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Name</mat-label>
        <input matInput formControlName="name" maxlength="120" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Email</mat-label>
        <input matInput type="email" formControlName="email" maxlength="200" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Role</mat-label>
        <mat-select formControlName="role">
          <mat-option value="admin">Admin</mat-option>
          <mat-option value="manager">Manager</mat-option>
          <mat-option value="staff">Staff</mat-option>
        </mat-select>
      </mat-form-field>

      <div class="actions">
        <button type="button" mat-stroked-button (click)="cancel()">Cancel</button>
        <button
          type="submit"
          mat-flat-button
          color="primary"
          [disabled]="form.invalid"
        >
          <i-tabler name="check" class="icon-sm mr-1"></i-tabler> Save
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .demo-form { display: flex; flex-direction: column; gap: 8px; }
      .demo-form .full { width: 100%; }
      .hint { font-size: 13px; color: #475569; margin: 0 0 8px; line-height: 1.45; }
      .hint code { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
      .actions {
        display: flex; justify-content: flex-end; gap: 8px;
        padding-top: 12px; border-top: 1px solid #f1f5f9; margin-top: 8px;
      }
      .mr-1 { margin-right: 4px; }
    `,
  ],
})
export class DemoFormComponent {
  private readonly fb = inject(FormBuilder);

  // Both injections are required here (the demo form is only ever opened via
  // the panel service), but use { optional: true } in real shared forms so
  // they can ALSO render as a routed full-page form.
  private readonly ref = inject<SidePanelRef<DemoFormResult>>(SidePanelRef);
  private readonly data = inject<{ prefill?: { name?: string; email?: string; role?: string } } | null>(
    SIDE_PANEL_DATA,
  );

  form = this.fb.nonNullable.group({
    name:  [this.data?.prefill?.name ?? '',  [Validators.required, Validators.maxLength(120)]],
    email: [this.data?.prefill?.email ?? '', [Validators.required, Validators.email]],
    role:  [this.data?.prefill?.role ?? 'staff'],
  });

  constructor() {
    // The discard-changes guard recipe — wire form.dirty into the panel
    // so backdrop / Esc / X attempts trigger `window.confirm(...)`.
    effect(() => {
      // Subscribing inside an effect ensures the subscription is torn
      // down when the component is destroyed. The valueChanges observable
      // fires on every keystroke; we recompute the dirty flag each time.
      const sub = this.form.valueChanges.subscribe(() => {
        this.ref.setDirty(this.form.dirty);
      });
      return () => sub.unsubscribe();
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.form.markAsPristine();
    this.ref.setDirty(false);
    this.ref.close({ status: 'saved', values: this.form.getRawValue() });
  }

  cancel(): void {
    // Honours the dirty guard — confirm prompt if form.dirty
    this.ref.close({ status: 'cancelled' });
  }
}
