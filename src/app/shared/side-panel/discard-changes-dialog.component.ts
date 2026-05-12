import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';

/**
 * Confirmation dialog shown by {@link SidePanelService} when a user
 * tries to dismiss a panel that has called `ref.setDirty(true)`.
 *
 * Not a public-API component — the side panel opens it automatically.
 * Style is intentionally consistent with the rest of the Material chrome
 * (rounded card, raised, two clear actions).
 */
export interface DiscardChangesDialogData {
  /** Optional override for the body text. Defaults to a sensible message. */
  message?: string;
}

@Component({
  selector: 'app-discard-changes-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatDialogModule, TablerIconsModule],
  template: `
    <div class="discard-dialog">
      <header class="head">
        <div class="icon-wrap" aria-hidden="true">
          <i-tabler name="alert-triangle" class="icon-md"></i-tabler>
        </div>
        <div class="text">
          <h2 mat-dialog-title class="title">Discard changes?</h2>
          <p class="subtitle">
            {{ data?.message ?? defaultMessage }}
          </p>
        </div>
      </header>
      <mat-dialog-actions align="end" class="actions">
        <button mat-stroked-button mat-dialog-close cdkFocusInitial>
          Keep editing
        </button>
        <button mat-flat-button color="warn" [mat-dialog-close]="true">
          <i-tabler name="trash" class="icon-sm mr-1"></i-tabler> Discard
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .discard-dialog {
        padding: 24px;
        min-width: 360px;
        max-width: 480px;
        background: #ffffff;
      }
      .head {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        margin-bottom: 8px;
      }
      .icon-wrap {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #fef3c7;
        color: #b45309;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .text {
        flex: 1;
        min-width: 0;
      }
      .title {
        margin: 0 !important;
        padding: 0 !important;
        font-size: 18px !important;
        font-weight: 600 !important;
        color: #0f172a;
        line-height: 1.3;
      }
      .subtitle {
        margin: 6px 0 0;
        font-size: 14px;
        color: #475569;
        line-height: 1.5;
      }
      .actions {
        padding: 0 !important;
        margin: 16px 0 0 !important;
        gap: 8px;
      }
      .mr-1 {
        margin-right: 4px;
      }
    `,
  ],
})
export class DiscardChangesDialogComponent {
  readonly defaultMessage =
    'You have unsaved edits in this form. If you close now, your changes will be lost.';

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: DiscardChangesDialogData | null,
  ) {}
}
