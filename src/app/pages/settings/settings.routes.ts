import { Routes } from '@angular/router';

export const SettingsRoutes: Routes = [
  {
    path: 'tenant',
    children: [
      {
        path: 'profile',
        loadComponent: () =>
          import('./tenant/tenant-profile/tenant-profile.component').then(
            (m) => m.TenantProfileComponent
          ),
      },
      {
        path: 'plan',
        loadComponent: () =>
          import('./tenant/tenant-plan/tenant-plan.component').then(
            (m) => m.TenantPlanComponent
          ),
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('./tenant/tenant-billing/tenant-billing.component').then(
            (m) => m.TenantBillingComponent
          ),
      },
      {
        path: '',
        redirectTo: 'profile',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'subscriptions',
    children: [
      {
        path: 'plans',
        loadComponent: () =>
          import('./subscriptions/plans/subscription-plans.component').then(
            (m) => m.SubscriptionPlansComponent
          ),
      },
      {
        path: 'subscribers',
        loadComponent: () =>
          import('./subscriptions/subscribers/subscribers.component').then(
            (m) => m.SubscribersComponent
          ),
      },
      {
        path: 'coupons',
        loadComponent: () =>
          import('./subscriptions/coupons/coupons.component').then(
            (m) => m.CouponsComponent
          ),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./subscriptions/history/subscription-history.component').then(
            (m) => m.SubscriptionHistoryComponent
          ),
      },
      {
        path: '',
        redirectTo: 'plans',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'whatsapp',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./whatsapp/whatsapp-list.component').then(
            (m) => m.WhatsAppListComponent
          ),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./whatsapp/whatsapp-form.component').then(
            (m) => m.WhatsAppFormComponent
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./whatsapp/whatsapp-form.component').then(
            (m) => m.WhatsAppFormComponent
          ),
      },
    ],
  },
  {
    path: 'ai',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./ai/ai-list.component').then((m) => m.AiListComponent),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./ai/ai-form.component').then((m) => m.AiFormComponent),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./ai/ai-form.component').then((m) => m.AiFormComponent),
      },
    ],
  },
  {
    path: 'system',
    loadComponent: () =>
      import('./system/system-settings.component').then(
        (m) => m.SystemSettingsComponent
      ),
  },
  {
    path: 'invoice',
    loadComponent: () =>
      import('./invoice/invoice-settings.component').then(
        (m) => m.InvoiceSettingsComponent
      ),
  },
  {
    path: 'scheduled-tasks',
    loadComponent: () =>
      import('./scheduled-tasks/scheduled-tasks.component').then(
        (m) => m.ScheduledTasksComponent
      ),
  },
  {
    path: 'data-reset',
    loadComponent: () =>
      import('./data-reset/data-reset.component').then(
        (m) => m.DataResetComponent
      ),
  },
  {
    path: 'locale',
    loadComponent: () =>
      import('./locale/locale-settings.component').then(
        (m) => m.LocaleSettingsComponent
      ),
  },
  {
    path: 'brand',
    loadComponent: () =>
      import('./brand/brand-settings.component').then(
        (m) => m.BrandSettingsComponent
      ),
    data: { scope: 'tenant' },
  },
  {
    path: 'storage',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./storage/storage-list.component').then(
            (m) => m.StorageListComponent
          ),
        data: { scope: 'tenant' },
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./storage/storage-form.component').then(
            (m) => m.StorageFormComponent
          ),
        data: { scope: 'tenant' },
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./storage/storage-form.component').then(
            (m) => m.StorageFormComponent
          ),
        data: { scope: 'tenant' },
      },
    ],
  },
  {
    path: 'email',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./email/email-list.component').then(
            (m) => m.EmailListComponent
          ),
        data: { scope: 'tenant' },
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./email/email-form.component').then(
            (m) => m.EmailFormComponent
          ),
        data: { scope: 'tenant' },
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./email/email-form.component').then(
            (m) => m.EmailFormComponent
          ),
        data: { scope: 'tenant' },
      },
    ],
  },
  {
    path: 'identity',
    children: [
      // Users
      {
        path: 'users',
        loadComponent: () =>
          import('./identity/users/users-list.component').then(
            (m) => m.UsersListComponent,
          ),
      },
      {
        path: 'users/new',
        loadComponent: () =>
          import('./identity/users/user-form.component').then(
            (m) => m.UserFormComponent,
          ),
      },
      {
        path: 'users/:id',
        loadComponent: () =>
          import('./identity/users/user-form.component').then(
            (m) => m.UserFormComponent,
          ),
      },

      // Roles
      {
        path: 'roles',
        loadComponent: () =>
          import('./identity/roles/roles-list.component').then(
            (m) => m.RolesListComponent,
          ),
      },
      {
        path: 'roles/new',
        loadComponent: () =>
          import('./identity/roles/role-form.component').then(
            (m) => m.RoleFormComponent,
          ),
      },
      {
        path: 'roles/:id',
        loadComponent: () =>
          import('./identity/roles/role-form.component').then(
            (m) => m.RoleFormComponent,
          ),
      },

      // Departments
      {
        path: 'departments',
        loadComponent: () =>
          import('./identity/departments/departments-list.component').then(
            (m) => m.DepartmentsListComponent,
          ),
      },
      {
        path: 'departments/new',
        loadComponent: () =>
          import('./identity/departments/department-form.component').then(
            (m) => m.DepartmentFormComponent,
          ),
      },
      {
        path: 'departments/:id',
        loadComponent: () =>
          import('./identity/departments/department-form.component').then(
            (m) => m.DepartmentFormComponent,
          ),
      },

      // Self-service profile
      {
        path: 'profile',
        loadComponent: () =>
          import('./identity/profile/my-profile.component').then(
            (m) => m.MyProfileComponent,
          ),
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./identity/profile/change-password.component').then(
            (m) => m.ChangePasswordComponent,
          ),
      },

      { path: '', redirectTo: 'users', pathMatch: 'full' },
    ],
  },
  {
    path: 'task-types',
    loadComponent: () =>
      import('./task-types/task-types.component').then(
        (m) => m.TaskTypesComponent
      ),
  },
  {
    path: '',
    redirectTo: 'tenant/profile',
    pathMatch: 'full',
  },
];
