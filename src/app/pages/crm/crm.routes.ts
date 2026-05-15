import { Routes } from '@angular/router';

export const CrmRoutes: Routes = [
  {
    path: '',
    children: [
      // ── Sales ──────────────────────────────────────────────────────────────
      {
        path: 'leads',
        loadComponent: () =>
          import('./leads/lead-list/lead-list.component').then((m) => m.LeadListComponent),
        data: { title: 'Leads', breadcrumb: 'Leads' },
      },
      {
        path: 'leads/new',
        loadComponent: () =>
          import('./leads/lead-form/lead-form.component').then((m) => m.LeadFormComponent),
        data: { title: 'New Lead', breadcrumb: 'New Lead' },
      },
      {
        path: 'leads/:id',
        loadComponent: () =>
          import('./leads/lead-form/lead-form.component').then((m) => m.LeadFormComponent),
        data: { title: 'Edit Lead', breadcrumb: 'Edit Lead' },
      },
      {
        path: 'companies',
        loadComponent: () =>
          import('./companies/company-list/company-list.component').then((m) => m.CompanyListComponent),
        data: { title: 'Companies', breadcrumb: 'Companies' },
      },

      // ── Deals ──────────────────────────────────────────────────────────────
      {
        path: 'deals',
        loadComponent: () =>
          import('./deals/deal-list/deal-list.component').then((m) => m.DealListComponent),
        data: { title: 'Deals', breadcrumb: 'Deals' },
      },
      {
        path: 'deals/pipeline',
        loadComponent: () =>
          import('./deals/deals-kanban/deals-kanban.component').then((m) => m.DealsKanbanComponent),
        data: { title: 'Deals Pipeline', breadcrumb: 'Pipeline' },
      },
      {
        path: 'deals/:id',
        loadComponent: () =>
          import('./deals/deal-detail/deal-detail.component').then((m) => m.DealDetailComponent),
        data: { title: 'Deal Detail', breadcrumb: 'Deal Detail' },
      },

      // ── Pipelines ──────────────────────────────────────────────────────────
      {
        path: 'pipelines',
        loadComponent: () =>
          import('./pipelines/pipeline-list/pipeline-list.component').then((m) => m.PipelineListComponent),
        data: { title: 'Pipelines', breadcrumb: 'Pipelines' },
      },
      {
        path: 'pipelines/:id',
        loadComponent: () =>
          import('./pipelines/pipeline-edit/pipeline-edit.component').then((m) => m.PipelineEditComponent),
        data: { title: 'Edit Pipeline', breadcrumb: 'Edit Pipeline' },
      },

      // ── Legacy redirect ────────────────────────────────────────────────────
      {
        path: 'pipeline',
        redirectTo: 'deals/pipeline',
        pathMatch: 'full',
      },

      // ── Travel ─────────────────────────────────────────────────────────────
      {
        path: 'bookings',
        loadComponent: () =>
          import('./bookings/booking-list/booking-list.component').then((m) => m.BookingListComponent),
        data: { title: 'Bookings', breadcrumb: 'Bookings' },
      },
      {
        path: 'packages',
        loadComponent: () =>
          import('./packages/package-list/package-list.component').then((m) => m.PackageListComponent),
        data: { title: 'Travel Packages', breadcrumb: 'Packages' },
      },
      {
        path: 'destinations',
        loadComponent: () =>
          import('./destinations/destination-list/destination-list.component').then((m) => m.DestinationListComponent),
        data: { title: 'Destinations', breadcrumb: 'Destinations' },
      },

      // ── Customers ──────────────────────────────────────────────────────────
      {
        path: 'customers',
        loadComponent: () =>
          import('./customers/customer-list/customer-list.component').then((m) => m.CustomerListComponent),
        data: { title: 'Customers', breadcrumb: 'Customers' },
      },

      // ── Reports ────────────────────────────────────────────────────────────
      {
        path: 'reports',
        loadComponent: () =>
          import('./reports/reports.component').then((m) => m.ReportsComponent),
        data: { title: 'Reports & Analytics', breadcrumb: 'Reports' },
      },

      // Default redirect
      {
        path: '',
        redirectTo: 'leads',
        pathMatch: 'full',
      },
    ],
  },
];
