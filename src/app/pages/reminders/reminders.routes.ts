import { Routes } from '@angular/router';

export const RemindersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./reminders-list.component').then((m) => m.RemindersListComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./reminder-form.component').then((m) => m.ReminderFormComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./reminder-form.component').then((m) => m.ReminderFormComponent),
  },
];
