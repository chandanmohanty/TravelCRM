import { NavItem } from '../../vertical/sidebar/nav-item/nav-item';

export const navItems: NavItem[] = [
  // ─── Overview ─────────────────────────────────────────────────────────────
  {
    navCap: 'Overview',
  },
  {
    displayName: 'Dashboards',
    iconName: 'solar:chart-line-duotone',
    route: 'dashboards',
    children: [
      {
        displayName: 'CRM Dashboard',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'dashboards/dashboard1',
      },
      {
        displayName: 'Sales Dashboard',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'dashboards/dashboard2',
      },
      {
        displayName: 'Analytics',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'dashboards/dashboard3',
      },
    ],
  },

  // ─── Sales ────────────────────────────────────────────────────────────────
  {
    displayName: 'Sales',
    iconName: 'solar:dollar-minimalistic-line-duotone',
    route: 'crm',
    ddType: 'two-column',
    children: [
      {
        displayName: 'Leads',
        iconName: 'solar:users-group-rounded-line-duotone',
        route: 'crm/leads',
      },
      {
        displayName: 'Add Lead',
        iconName: 'solar:user-plus-rounded-line-duotone',
        route: 'crm/leads/new',
      },
      {
        displayName: 'Contacts',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/contacts',
      },
      {
        displayName: 'Companies',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'crm/companies',
      },
      {
        displayName: 'Deals',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'crm/deals',
      },
      {
        displayName: 'Pipeline View',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'crm/deals/pipeline',
      },
      {
        displayName: 'Pipelines',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'crm/pipelines',
      },
      {
        displayName: 'Invoices',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/invoice/list',
      },
      {
        displayName: 'Create Invoice',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/invoice/addInvoice',
      },
    ],
  },

  // ─── Travel ───────────────────────────────────────────────────────────────
  {
    displayName: 'Travel',
    iconName: 'solar:map-point-wave-line-duotone',
    route: 'crm',
    ddType: 'two-column',
    children: [
      {
        displayName: 'Bookings',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'crm/bookings',
      },
      {
        displayName: 'Packages',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'crm/packages',
      },
      {
        displayName: 'Destinations',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'crm/destinations',
      },
      {
        displayName: 'Customers',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'crm/customers',
      },
      {
        displayName: 'Reports',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'crm/reports',
      },
    ],
  },

  // ─── Inventory ────────────────────────────────────────────────────────────
  {
    displayName: 'Inventory',
    iconName: 'solar:case-line-duotone',
    route: 'inventory',
    children: [
      {
        displayName: 'All Suppliers',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'inventory/suppliers',
      },
      {
        displayName: 'Add Supplier',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'inventory/suppliers/new',
      },
      {
        displayName: 'Settings',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'inventory/settings',
      },
    ],
  },

  // ─── Operations ───────────────────────────────────────────────────────────
  {
    displayName: 'Operations',
    iconName: 'solar:archive-minimalistic-line-duotone',
    route: 'apps',
    children: [
      {
        displayName: 'Calendar',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/calendar',
      },
      {
        displayName: 'Tasks',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/todo',
      },
      {
        displayName: 'Support Tickets',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/tickets',
      },
      {
        displayName: 'Email',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/email/inbox',
      },
      {
        displayName: 'Chat',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/chat',
      },
      {
        displayName: 'Kanban',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/kanban',
      },
    ],
  },

  // ─── Admin ────────────────────────────────────────────────────────────────
  {
    displayName: 'Admin',
    iconName: 'solar:settings-line-duotone',
    route: '',
    children: [
      {
        displayName: 'Team Members',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/employee',
      },
      {
        displayName: 'Roles & Access',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/permission',
      },
      {
        displayName: 'Account Settings',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'theme-pages/account-setting',
      },
      {
        displayName: 'FAQ',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'theme-pages/faq',
      },
    ],
  },
];
