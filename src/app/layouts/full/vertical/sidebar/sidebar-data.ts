import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  // ─── Overview ─────────────────────────────────────────────────────────────
  {
    navCap: 'Overview',
  },
  {
    id: 1,
    displayName: 'CRM Dashboard',
    iconName: 'solar:widget-add-line-duotone',
    route: '/dashboards/dashboard1',
  },
  {
    id: 1,
    displayName: 'Sales Dashboard',
    iconName: 'solar:chart-line-duotone',
    route: '/dashboards/dashboard2',
  },
  {
    id: 1,
    displayName: 'Analytics',
    iconName: 'solar:screencast-2-line-duotone',
    route: '/dashboards/dashboard3',
  },

  // ─── Sales ────────────────────────────────────────────────────────────────
  {
    navCap: 'Sales',
  },
  {
    id: 2,
    displayName: 'Leads',
    iconName: 'solar:users-group-rounded-line-duotone',
    route: '/crm/leads',
    children: [
      {
        displayName: 'All Leads',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        subItemIcon: true,
        route: '/crm/leads',
      },
      {
        displayName: 'Add Lead',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        subItemIcon: true,
        route: '/crm/leads/new',
      },
    ],
  },
  {
    id: 2,
    displayName: 'Contacts',
    iconName: 'solar:phone-line-duotone',
    route: 'apps/contacts',
  },
  {
    id: 2,
    displayName: 'Companies',
    iconName: 'solar:buildings-2-line-duotone',
    route: '/crm/companies',
  },
  {
    id: 2,
    displayName: 'Pipeline',
    iconName: 'solar:clapperboard-edit-line-duotone',
    route: '/crm/pipeline',
  },
  {
    id: 2,
    displayName: 'Quotations',
    iconName: 'solar:bill-list-line-duotone',
    route: 'apps/invoice/list',
    children: [
      {
        displayName: 'Quote List',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        subItemIcon: true,
        route: 'apps/invoice/list',
      },
      {
        displayName: 'Create Quote',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        subItemIcon: true,
        route: 'apps/invoice/addInvoice',
      },
    ],
  },

  // ─── Travel ───────────────────────────────────────────────────────────────
  {
    navCap: 'Travel',
  },
  {
    id: 3,
    displayName: 'Bookings',
    iconName: 'solar:calendar-mark-line-duotone',
    route: '/crm/bookings',
    chip: true,
    chipClass: 'b-1 border-success text-success',
    chipContent: 'New',
  },
  {
    id: 3,
    displayName: 'Packages',
    iconName: 'solar:archive-minimalistic-line-duotone',
    route: '/crm/packages',
  },
  {
    id: 3,
    displayName: 'Destinations',
    iconName: 'solar:map-point-wave-line-duotone',
    route: '/crm/destinations',
  },
  {
    id: 3,
    displayName: 'Suppliers',
    iconName: 'solar:delivery-line-duotone',
    route: 'apps/employee',
  },

  // ─── Customers ────────────────────────────────────────────────────────────
  {
    navCap: 'Customers',
  },
  {
    id: 4,
    displayName: 'All Customers',
    iconName: 'solar:user-circle-line-duotone',
    route: '/crm/customers',
  },
  {
    id: 4,
    displayName: 'Loyalty Program',
    iconName: 'solar:star-line-duotone',
    route: '/crm/customers',
  },
  {
    id: 4,
    displayName: 'Customer Profile',
    iconName: 'solar:user-id-line-duotone',
    route: 'apps/profile-details',
    children: [
      {
        displayName: 'Profile',
        subItemIcon: true,
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/profile-details/profile',
      },
      {
        displayName: 'Followers',
        subItemIcon: true,
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/profile-details/followers',
      },
      {
        displayName: 'Gallery',
        subItemIcon: true,
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/profile-details/gallery',
      },
    ],
  },

  // ─── Reminders ────────────────────────────────────────────────────────────
  {
    navCap: 'Automation',
  },
  {
    id: 5,
    displayName: 'Reminders',
    iconName: 'solar:bell-bing-line-duotone',
    route: '/reminders',
    chip: true,
    chipClass: 'b-1 border-primary text-primary',
    chipContent: 'New',
  },

  // ─── Operations ───────────────────────────────────────────────────────────
  {
    navCap: 'Operations',
  },
  {
    id: 6,
    displayName: 'Calendar',
    iconName: 'solar:calendar-mark-line-duotone',
    route: 'apps/calendar',
  },
  {
    id: 6,
    displayName: 'Tasks',
    iconName: 'solar:checklist-minimalistic-line-duotone',
    route: 'apps/task',
  },
  {
    id: 6,
    displayName: 'Support Tickets',
    iconName: 'solar:ticket-sale-line-duotone',
    route: 'apps/tickets',
  },
  {
    id: 6,
    displayName: 'Email',
    iconName: 'solar:letter-line-duotone',
    route: 'apps/email/inbox',
  },
  {
    id: 6,
    displayName: 'Chat',
    iconName: 'solar:chat-round-line-line-duotone',
    route: 'apps/chat',
  },
  {
    id: 6,
    displayName: 'Notes',
    iconName: 'solar:document-text-line-duotone',
    route: 'apps/notes',
  },
  {
    id: 6,
    displayName: 'Kanban Board',
    iconName: 'solar:clapperboard-line-duotone',
    route: 'apps/kanban',
  },

  // ─── Marketing ────────────────────────────────────────────────────────────
  {
    navCap: 'Marketing',
  },
  {
    id: 7,
    displayName: 'Campaigns',
    iconName: 'solar:chart-square-line-duotone',
    route: 'apps/blog',
    children: [
      {
        displayName: 'All Campaigns',
        subItemIcon: true,
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/blog/post',
      },
      {
        displayName: 'Create Campaign',
        subItemIcon: true,
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        route: 'apps/blog/detail/new-campaign',
      },
    ],
  },
  {
    id: 7,
    displayName: 'Courses & Training',
    iconName: 'solar:book-bookmark-line-duotone',
    route: 'apps/courses',
  },
  {
    id: 7,
    displayName: 'Contact List',
    iconName: 'solar:folder-2-line-duotone',
    route: 'apps/contact-list',
  },

  // ─── Finance ──────────────────────────────────────────────────────────────
  {
    navCap: 'Finance',
  },
  {
    id: 8,
    displayName: 'Invoices',
    iconName: 'solar:bill-list-line-duotone',
    route: 'apps/invoice',
    children: [
      {
        displayName: 'Invoice List',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        subItemIcon: true,
        route: 'apps/invoice/list',
      },
      {
        displayName: 'Create Invoice',
        iconName: 'solar:round-alt-arrow-right-line-duotone',
        subItemIcon: true,
        route: 'apps/invoice/addInvoice',
      },
    ],
  },
  {
    id: 8,
    displayName: 'Reports & Analytics',
    iconName: 'solar:pie-chart-2-line-duotone',
    route: '/crm/reports',
    chip: true,
    chipClass: 'b-1 border-primary text-primary',
    chipContent: 'New',
  },

  // ─── Administration ───────────────────────────────────────────────────────
  {
    navCap: 'Administration',
  },
  {
    id: 9,
    displayName: 'Team Members',
    iconName: 'solar:user-id-line-duotone',
    route: 'apps/employee',
  },
  {
    id: 9,
    displayName: 'Roles & Access',
    iconName: 'solar:lock-password-unlocked-line-duotone',
    route: 'apps/permission',
  },
  {
    id: 9,
    displayName: 'Account Settings',
    iconName: 'solar:accessibility-line-duotone',
    route: 'theme-pages/account-setting',
  },
  {
    id: 9,
    displayName: 'Language & Region',
    iconName: 'solar:global-line-duotone',
    route: 'settings/locale',
  },
  {
    id: 9,
    displayName: 'FAQ',
    iconName: 'solar:question-square-line-duotone',
    route: 'theme-pages/faq',
  },

  // ─── Platform Admin (icon id: 10) ────────────────────────────────────────
  {
    id: 10,
    displayName: 'Platform Admin',
    iconName: 'solar:shield-keyhole-line-duotone',
    children: [
      {
        navCap: 'Platform Administration',
      },
      {
        displayName: 'Overview',
        iconName: 'solar:pie-chart-2-line-duotone',
        route: '/platform-admin/dashboard',
      },
      {
        displayName: 'Tenant Management',
        iconName: 'solar:buildings-3-line-duotone',
        route: '/platform-admin/tenants',
        chip: true,
        chipClass: 'bg-primary text-white',
        chipContent: 'Admin',
      },
      {
        displayName: 'Platform Branding',
        iconName: 'solar:palette-line-duotone',
        route: '/platform-admin/brand',
      },
      {
        displayName: 'Platform Storage',
        iconName: 'solar:cloud-line-duotone',
        route: '/platform-admin/storage',
      },
      {
        displayName: 'Platform Email',
        iconName: 'solar:letter-line-duotone',
        route: '/platform-admin/email',
      },
      {
        navCap: 'Subscriptions',
      },
      {
        displayName: 'Manage Subscriptions',
        iconName: 'solar:card-2-line-duotone',
        route: '/settings/subscriptions',
        children: [
          {
            displayName: 'Plans & Pricing',
            iconName: 'solar:round-alt-arrow-right-line-duotone',
            subItemIcon: true,
            route: '/settings/subscriptions/plans',
          },
          {
            displayName: 'Subscribers',
            iconName: 'solar:round-alt-arrow-right-line-duotone',
            subItemIcon: true,
            route: '/settings/subscriptions/subscribers',
          },
          {
            displayName: 'Coupons & Discounts',
            iconName: 'solar:round-alt-arrow-right-line-duotone',
            subItemIcon: true,
            route: '/settings/subscriptions/coupons',
          },
          {
            displayName: 'Subscription History',
            iconName: 'solar:round-alt-arrow-right-line-duotone',
            subItemIcon: true,
            route: '/settings/subscriptions/history',
          },
        ],
      },
    ],
  },

  // ─── Settings (icon id: 9) ────────────────────────────────────────────────
  {
    id: 9,
    displayName: 'Settings',
    iconName: 'solar:settings-line-duotone',
    children: [
      {
        navCap: 'Settings',
      },
      {
        displayName: 'Manage Tenant',
        iconName: 'solar:buildings-3-line-duotone',
        route: '/settings/tenant',
        children: [
          {
            displayName: 'Tenant Profile',
            iconName: 'solar:round-alt-arrow-right-line-duotone',
            subItemIcon: true,
            route: '/settings/tenant/profile',
          },
          {
            displayName: 'Subscription & Plan',
            iconName: 'solar:round-alt-arrow-right-line-duotone',
            subItemIcon: true,
            route: '/settings/tenant/plan',
          },
          {
            displayName: 'Billing',
            iconName: 'solar:round-alt-arrow-right-line-duotone',
            subItemIcon: true,
            route: '/settings/tenant/billing',
          },
        ],
      },
      {
        displayName: 'Brand Settings',
        iconName: 'solar:palette-line-duotone',
        route: '/settings/brand',
      },
      {
        displayName: 'Storage',
        iconName: 'solar:cloud-line-duotone',
        route: '/settings/storage',
      },
      {
        displayName: 'Email Settings',
        iconName: 'solar:letter-line-duotone',
        route: '/settings/email',
      },
      {
        displayName: 'AI Providers',
        iconName: 'solar:chat-round-dots-line-duotone',
        route: '/settings/ai',
      },
      {
        displayName: 'WhatsApp',
        iconName: 'solar:chat-square-like-line-duotone',
        route: '/settings/whatsapp',
      },
      {
        displayName: 'System Settings',
        iconName: 'solar:settings-line-duotone',
        route: '/settings/system',
      },
      {
        displayName: 'Invoice Settings',
        iconName: 'solar:bill-list-line-duotone',
        route: '/settings/invoice',
      },
      {
        displayName: 'Scheduled Tasks',
        iconName: 'solar:clock-circle-line-duotone',
        route: '/settings/scheduled-tasks',
      },
      {
        displayName: 'Task Types',
        iconName: 'solar:tag-line-duotone',
        route: '/settings/task-types',
      },
      {
        displayName: 'Data Reset',
        iconName: 'solar:trash-bin-trash-line-duotone',
        route: '/settings/data-reset',
      },
      {
        displayName: 'User Management',
        iconName: 'solar:users-group-two-rounded-line-duotone',
        route: '/settings/identity/users',
      },
      {
        displayName: 'Roles & Permissions',
        iconName: 'solar:shield-user-line-duotone',
        route: '/settings/identity/roles',
      },
      {
        displayName: 'Departments',
        iconName: 'solar:buildings-line-duotone',
        route: '/settings/identity/departments',
      },
      {
        displayName: 'My Profile',
        iconName: 'solar:user-circle-line-duotone',
        route: '/settings/identity/profile',
      },
      {
        displayName: 'Account Settings',
        iconName: 'solar:accessibility-line-duotone',
        route: 'theme-pages/account-setting',
      },
      {
        displayName: 'Language & Region',
        iconName: 'solar:global-line-duotone',
        route: 'settings/locale',
      },
    ],
  },
];
