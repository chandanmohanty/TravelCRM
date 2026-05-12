# SidePanel — reusable slide-in drawer

A standalone, signal-based Angular 21 component for rendering forms (or any content) in a side panel that slides in from the edge of the viewport. Designed to replace `MatDialog`-based popups for form UX.

Looks like the Settings drawer in the SpikeAdmin theme — white background, rounded inner corners, dim backdrop, ESC + click-backdrop to close.

## Two ways to open it

### 1. Imperative — replace `MatDialog.open(...)` calls

```ts
import { inject } from '@angular/core';
import { SidePanelService } from 'src/app/shared/side-panel';

export class SupplierListComponent {
  private readonly sidePanel = inject(SidePanelService);

  openEdit(supplier: SupplierDto) {
    const ref = this.sidePanel.open(SupplierFormComponent, {
      title:    'Edit Supplier',
      subtitle: supplier.name,
      width:    '520px',
      data:     { id: supplier.id },
    });

    ref.afterClosed().subscribe(result => {
      if (result === 'saved') this.reload();
    });
  }
}
```

Inside the rendered component:

```ts
import { inject } from '@angular/core';
import { SIDE_PANEL_DATA, SidePanelRef } from 'src/app/shared/side-panel';

export class SupplierFormComponent {
  private readonly data = inject<{ id: string }>(SIDE_PANEL_DATA);
  private readonly ref  = inject<SidePanelRef<'saved' | 'cancelled'>>(SidePanelRef);

  save() {
    this.api.update(this.data.id, this.form.value).subscribe(() => {
      this.ref.close('saved');
    });
  }

  cancel() {
    this.ref.close('cancelled');
  }
}
```

### 2. Template — bind `[open]` from a parent component

```html
<app-side-panel
  [open]="showFilters()"
  title="Filters"
  subtitle="Narrow the list to what matters"
  width="420px"
  (closed)="showFilters.set(false)">

  <!-- body -->
  <p>Filter controls go here…</p>

  <!-- footer (right-aligned automatically) -->
  <div panelFooter>
    <button mat-stroked-button (click)="reset()">Reset</button>
    <button mat-flat-button color="primary" (click)="apply()">Apply</button>
  </div>
</app-side-panel>
```

```ts
import { SidePanelComponent } from 'src/app/shared/side-panel';

@Component({
  imports: [SidePanelComponent, /* ... */],
})
export class LeadListComponent {
  showFilters = signal(false);
}
```

## API

### `SidePanelConfig<D>`

| Field | Default | What it does |
|---|---|---|
| `title` | `''` | Header title text |
| `subtitle` | `undefined` | Optional subtitle below the title |
| `position` | `'right'` | `'right'` (default) or `'left'` |
| `width` | `'480px'` | Any CSS length — `'40vw'`, `'600px'`, etc. |
| `data` | `undefined` | Payload — injected via `SIDE_PANEL_DATA` in the rendered component |
| `closeOnBackdropClick` | `true` | Click on the dim backdrop closes the panel |
| `closeOnEscape` | `true` | Escape key closes the panel |
| `hideHeader` | `false` | Suppress the built-in header (your component renders its own) |
| `panelClass` | `undefined` | Extra CSS class on the panel `<aside>` (for one-off styling) |

### `SidePanelService`

| Method | Returns |
|---|---|
| `open<T, D, R>(component, config?)` | `SidePanelRef<R>` |
| `closeAll()` | `void` — closes every open panel without a result |

### `SidePanelRef<R>`

| Member | Notes |
|---|---|
| `close(result?: R)` | Dismiss with optional payload delivered to `afterClosed()`. |
| `afterClosed(): Observable<R \| undefined>` | Emits exactly once when the panel finishes closing (after the leave animation). |

### `SIDE_PANEL_DATA`

`InjectionToken<unknown>`. Inside the rendered component:

```ts
private readonly data = inject<MyDataShape>(SIDE_PANEL_DATA);
```

If you call `open(MyForm)` without a `data` field, the injected value is `null`.

## Behaviour

- **Slide animation** — 220 ms ease-out on open, 200 ms ease-in on close.
- **Backdrop fade** — 180 ms on either side.
- **Scroll lock** — sets `document.body.style.overflow = 'hidden'` while open; restores the previous value on close.
- **Escape key** — handled per-panel via `@HostListener('document:keydown.escape')`. Disable with `closeOnEscape: false`.
- **Mobile** — under 600 px viewport width, the panel takes the full viewport width and drops its corner radii.
- **Stacking** — backdrop is `z-index: 1040`, panel is `1041`. Material dialogs are `1000` so a panel renders above them if mixed.

## When NOT to use it

- For **destructive confirmations** (delete, irreversible actions) — use `MatDialog` so the user has to dismiss explicitly. A side panel that closes on backdrop click is too easy to dismiss.
- For **modal flows that block multi-step interaction** (wizards that own the screen) — use a routed page.
- For **transient notifications** (success/error toasts) — use `MatSnackBar`.

The side panel is the right call for **editing a record without losing list context** — exactly what the SpikeAdmin Settings drawer demonstrates.

## Migration recipe (from `MatDialog`)

If you have an existing form opened as a dialog:

```ts
// Before
const ref = this.dialog.open(SupplierFormComponent, {
  width: '520px',
  data: { id },
});
ref.afterClosed().subscribe(...);

// Inside SupplierFormComponent
private readonly data = inject<{ id: string }>(MAT_DIALOG_DATA);
private readonly dialogRef = inject(MatDialogRef);
this.dialogRef.close('saved');
```

```ts
// After
const ref = this.sidePanel.open(SupplierFormComponent, {
  title: 'Edit Supplier',
  width: '520px',
  data: { id },
});
ref.afterClosed().subscribe(...);

// Inside SupplierFormComponent
private readonly data = inject<{ id: string }>(SIDE_PANEL_DATA);
private readonly ref  = inject(SidePanelRef);
this.ref.close('saved');
```

Two find-and-replace passes (`MAT_DIALOG_DATA` → `SIDE_PANEL_DATA`, `MatDialogRef` → `SidePanelRef`) plus deleting the `MatDialogModule` imports, and you're done.
