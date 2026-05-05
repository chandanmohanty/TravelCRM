import { Routes } from '@angular/router';
import { platformAdminGuard } from '../../core/guards/platform-admin.guard';

export const PlatformAdminRoutes: Routes = [
  {
    path: '',
    canActivate: [platformAdminGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/platform-dashboard.component').then(
            (m) => m.PlatformDashboardComponent
          ),
      },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./tenants/tenants-management.component').then(
            (m) => m.TenantsManagementComponent
          ),
      },
      {
        path: 'brand',
        loadComponent: () =>
          import('../settings/brand/brand-settings.component').then(
            (m) => m.BrandSettingsComponent
          ),
        data: { scope: 'platform' },
      },
      {
        path: 'storage',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../settings/storage/storage-list.component').then(
                (m) => m.StorageListComponent
              ),
            data: { scope: 'platform' },
          },
          {
            path: 'new',
            loadComponent: () =>
              import('../settings/storage/storage-form.component').then(
                (m) => m.StorageFormComponent
              ),
            data: { scope: 'platform' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('../settings/storage/storage-form.component').then(
                (m) => m.StorageFormComponent
              ),
            data: { scope: 'platform' },
          },
        ],
      },
      {
        path: 'email',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../settings/email/email-list.component').then(
                (m) => m.EmailListComponent
              ),
            data: { scope: 'platform' },
          },
          {
            path: 'new',
            loadComponent: () =>
              import('../settings/email/email-form.component').then(
                (m) => m.EmailFormComponent
              ),
            data: { scope: 'platform' },
          },
          {
            path: ':id',
            loadComponent: () =>
              import('../settings/email/email-form.component').then(
                (m) => m.EmailFormComponent
              ),
            data: { scope: 'platform' },
          },
        ],
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
];
