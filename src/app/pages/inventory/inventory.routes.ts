import { Routes } from '@angular/router';

export const InventoryRoutes: Routes = [
  {
    path: 'suppliers',
    loadComponent: () =>
      import('./suppliers/supplier-list/supplier-list.component').then((m) => m.SupplierListComponent),
    data: { title: 'Suppliers' },
  },
  {
    path: 'suppliers/new',
    loadComponent: () =>
      import('./suppliers/supplier-form/supplier-form.component').then((m) => m.SupplierFormComponent),
    data: { title: 'New Supplier' },
  },
  {
    path: 'suppliers/:id',
    loadComponent: () =>
      import('./suppliers/supplier-form/supplier-form.component').then((m) => m.SupplierFormComponent),
    data: { title: 'Edit Supplier' },
  },
  { path: '', redirectTo: 'suppliers', pathMatch: 'full' },
];
