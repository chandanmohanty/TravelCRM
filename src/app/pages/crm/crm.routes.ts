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
      {
        path: 'pipeline',
        loadComponent: () =>
          import('./pipeline/pipeline.component').then((m) => m.PipelineComponent),
        data: { title: 'Sales Pipeline', breadcrumb: 'Pipeline' },
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
