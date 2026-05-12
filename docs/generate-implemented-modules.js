// Generates docs/implemented-modules.docx — a formatted report of all
// implemented modules in TravelCRMPlus.

const fs = require('fs');
const path = require('path');

// Use globally-installed docx
const docxPath = path.join(
  process.env.APPDATA || '',
  'npm/node_modules/docx'
);
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, Header, Footer,
} = require(docxPath);

// ── Style helpers ────────────────────────────────────────────────────────

const border = (color = 'CCCCCC') => ({
  style: BorderStyle.SINGLE, size: 4, color,
});
const cellBorders = {
  top: border(), bottom: border(),
  left: border(), right: border(),
};
const cellMargins = { top: 100, bottom: 100, left: 140, right: 140 };

const PAGE_WIDTH = 12240;     // US Letter
const PAGE_HEIGHT = 15840;
const MARGIN = 1080;          // 0.75 in
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN; // 10080 DXA

// ── Reusable cell builders ───────────────────────────────────────────────

function headerCell(width, text) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    margins: cellMargins,
    shading: { fill: '1F3A93', type: ShadingType.CLEAR, color: 'auto' },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 22 })],
    })],
  });
}

function bodyCell(width, text, opts = {}) {
  const runs = (Array.isArray(text) ? text : [text]).map((t) => {
    if (typeof t === 'object') return new TextRun(t);
    return new TextRun({ text: t, size: 20 });
  });
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    margins: cellMargins,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: [new Paragraph({ children: runs })],
  });
}

// Status pill — coloured background based on status
function statusCell(width, status) {
  const map = {
    'Full':         { fill: 'D4F4DD', color: '14532D' },
    'Backend-only': { fill: 'FEF3C7', color: '78350F' },
    'Frontend-only':{ fill: 'FFE4E6', color: '7F1D1D' },
    'Hook':         { fill: 'E0E7FF', color: '3730A3' },
  };
  const cfg = map[status] || { fill: 'F1F5F9', color: '475569' };
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    margins: cellMargins,
    shading: { fill: cfg.fill, type: ShadingType.CLEAR, color: 'auto' },
    children: [new Paragraph({
      children: [new TextRun({ text: status, bold: true, color: cfg.color, size: 20 })],
    })],
  });
}

// Standard 4-column module table: Module | Backend | Frontend | Status
function moduleTable(rows) {
  // Column widths sum to CONTENT_WIDTH = 10080
  const cols = [2700, 3000, 3000, 1380];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell(cols[0], 'Module'),
      headerCell(cols[1], 'Backend'),
      headerCell(cols[2], 'Frontend'),
      headerCell(cols[3], 'Status'),
    ],
  });
  const bodyRows = rows.map((r) => new TableRow({
    children: [
      bodyCell(cols[0], r.module),
      bodyCell(cols[1], r.backend || '—'),
      bodyCell(cols[2], r.frontend || '—'),
      statusCell(cols[3], r.status),
    ],
  }));
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: cols,
    rows: [headerRow, ...bodyRows],
  });
}

// 2-column table: Item | Description
function twoColTable(rows, headers = ['Concern', 'Implementation'], widths = [3200, 6880]) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell(widths[0], headers[0]),
      headerCell(widths[1], headers[1]),
    ],
  });
  const bodyRows = rows.map((r) => new TableRow({
    children: [
      bodyCell(widths[0], r[0]),
      bodyCell(widths[1], r[1]),
    ],
  }));
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...bodyRows],
  });
}

// ── Section headings + spacers ───────────────────────────────────────────

const spacer = (n = 1) =>
  Array.from({ length: n }, () => new Paragraph({ children: [new TextRun('')] }));

const sectionHeading = (label) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 280, after: 140 },
  children: [new TextRun({ text: label, bold: true, size: 30, color: '1F3A93' })],
});

const sectionIntro = (text) => new Paragraph({
  spacing: { after: 160 },
  children: [new TextRun({ text, italics: true, size: 21, color: '475569' })],
});

// ── Data ─────────────────────────────────────────────────────────────────

const identityRows = [
  { module: 'Authentication (login, refresh, logout)', backend: 'Features/Auth', frontend: 'pages/authentication/', status: 'Full' },
  { module: 'Forgot / reset password', backend: 'Features/Identity + PasswordResetTokenService', frontend: 'pages/authentication/{forgot,reset}-password', status: 'Full' },
  { module: 'Users', backend: 'Features/Identity', frontend: 'pages/settings/identity/users/', status: 'Full' },
  { module: 'Roles + role-permission matrix', backend: 'Features/Identity', frontend: 'pages/settings/identity/roles/', status: 'Full' },
  { module: 'Departments', backend: 'Features/Identity', frontend: 'pages/settings/identity/departments/', status: 'Full' },
  { module: 'My profile / account settings / change password', backend: 'Features/Identity + Settings/Profile', frontend: 'pages/settings/identity/profile/', status: 'Full' },
  { module: 'Permissions catalog', backend: 'Common/PermissionCatalog + RolePermissionSeeder', frontend: '(admin-managed via Roles UI)', status: 'Full' },
];

const platformRows = [
  { module: 'Tenant management (create / list / toggle)', backend: 'Features/Platform + Controllers/Platform/TenantsController', frontend: 'pages/platform-admin/tenants/', status: 'Full' },
  { module: 'Platform dashboard + stats', backend: 'Controllers/Platform/PlatformStatsController', frontend: 'pages/platform-admin/dashboard/', status: 'Full' },
  { module: 'Platform brand settings', backend: 'Features/Branding + Controllers/Platform/PlatformBrandController', frontend: 'pages/settings/brand/', status: 'Full' },
  { module: 'Platform-level configs (Plans, etc.)', backend: 'Controllers/Platform/PlatformConfigsController', frontend: 'pages/subscriptions/', status: 'Full' },
  { module: 'Data reset (destructive admin tool)', backend: 'Controllers/DataResetController', frontend: 'pages/settings/data-reset/', status: 'Full' },
];

const tenantSettingsRows = [
  { module: 'Tenant brand (logos, colors)', backend: 'Features/Branding + TenantBrandController', frontend: 'pages/settings/brand/', status: 'Full' },
  { module: 'System settings', backend: 'Features/Settings/System', frontend: 'pages/settings/system/', status: 'Full' },
  { module: 'Invoice settings', backend: 'Features/Settings/Invoice', frontend: 'pages/settings/invoice/', status: 'Full' },
  { module: 'Email (SMTP) configs', backend: 'Features/Email + TenantEmailController', frontend: 'pages/settings/email/', status: 'Full' },
  { module: 'WhatsApp configs (Wati)', backend: 'Features/Settings/WhatsApp + WhatsAppSettingsController', frontend: 'pages/settings/whatsapp/', status: 'Full' },
  { module: 'File storage configs (local + S3)', backend: 'Features/Storage + TenantStorageController', frontend: 'pages/settings/storage/', status: 'Full' },
  { module: 'AI provider configs (Anthropic + others)', backend: 'Features/Settings/AiProvider + AiSettingsController', frontend: 'pages/settings/ai/', status: 'Full' },
  { module: 'Locale', backend: 'Controllers/LocaleController + i18n', frontend: 'pages/settings/locale/', status: 'Full' },
  { module: 'Scheduled tasks (Hangfire)', backend: 'Controllers/ScheduledTasksController', frontend: 'pages/settings/scheduled-tasks/', status: 'Full' },
  { module: 'Task type catalog', backend: 'Features/TaskTypes + TaskTypesController', frontend: 'pages/settings/task-types/', status: 'Full' },
  { module: 'Inventory tenant settings (HoldTtlHours)', backend: 'Features/Inventory/TenantSettings', frontend: 'pages/inventory/tenant-settings/', status: 'Full' },
];

const crmRows = [
  { module: 'Leads', backend: 'Features/Leads + LeadsController', frontend: 'pages/crm/leads/ (list + form)', status: 'Full' },
  { module: 'Tasks (CRM)', backend: 'Features/Tasks + TasksController', frontend: 'apps/task/ (list, form, detail, kanban)', status: 'Full' },
  { module: 'Time Entries (per-task logging)', backend: 'Features/TimeEntries + TimeEntriesController', frontend: 'embedded in task detail page', status: 'Full' },
  { module: 'Reminders', backend: 'Features/Reminders + RemindersController', frontend: 'pages/reminders/', status: 'Full' },
  { module: 'Companies', backend: '—', frontend: 'pages/crm/companies/', status: 'Frontend-only' },
  { module: 'Customers', backend: '—', frontend: 'pages/crm/customers/', status: 'Frontend-only' },
  { module: 'Bookings', backend: '—', frontend: 'pages/crm/bookings/', status: 'Frontend-only' },
  { module: 'Packages', backend: '—', frontend: 'pages/crm/packages/', status: 'Frontend-only' },
  { module: 'Destinations', backend: '—', frontend: 'pages/crm/destinations/', status: 'Frontend-only' },
  { module: 'Pipeline (sales)', backend: '—', frontend: 'pages/crm/pipeline/', status: 'Frontend-only' },
  { module: 'Reports', backend: '—', frontend: 'pages/crm/reports/', status: 'Frontend-only' },
];

const inventoryRows = [
  { module: 'Suppliers (Hotels, Transport, Activity, Guide)', backend: 'Features/Inventory/Suppliers (5 endpoints)', frontend: 'pages/inventory/suppliers/ (list + form)', status: 'Full' },
  { module: 'Resources (PoolResource + AssetResource TPH)', backend: 'Features/Inventory/Resources (6 endpoints)', frontend: '—', status: 'Backend-only' },
  { module: 'Calendar (capacity overrides + block dates)', backend: 'Features/Inventory/Calendar + AvailabilityCalculator (4 endpoints)', frontend: '—', status: 'Backend-only' },
  { module: 'Holds (Held → Confirmed/Released/Expired)', backend: 'Features/Inventory/Holds (6 endpoints) + Hangfire sweep', frontend: '—', status: 'Backend-only' },
  { module: 'Pricing strategy interface', backend: 'IResourcePricing + NullResourcePricing', frontend: '—', status: 'Hook' },
];

const infraRows = [
  ['Multi-tenancy', 'ITenantContext resolved from subdomain or header; tenant-scoped DbSets via global filter'],
  ['JWT auth', 'Jwt config + access/refresh token issuance + HttpCurrentUser from claims'],
  ['API envelope', 'ApiEnvelopeFilter wraps every response into { success, data, error, errors, correlationId }'],
  ['Validation pipeline', 'ValidationBehavior (MediatR) + FluentValidation per command'],
  ['Audit logging', 'AuditSaveChangesInterceptor writes to audit_logs table'],
  ['Correlation ID', 'Middleware sets X-Correlation-Id on every request/log'],
  ['File storage', 'LocalDiskFileStorage + S3FileStorage switchable per tenant'],
  ['Hangfire jobs', 'Heartbeat (hourly), Overdue tasks (daily), Hold expiry sweep (every 5 min)'],
  ['Logging', 'Serilog → console + file (logs/travelcrm-*.log) + optional Seq sink'],
  ['Database', 'PostgreSQL via Npgsql, EF Core migrations'],
];

const themeRows = [
  ['Apps (demo)', 'chat, email inbox, calendar (fullcalendar), notes, kanban, blogs, courses, contact / contact-list, fullcalendar, employee, todo, ecommerce, invoice (template), tickets, permission, profile-content'],
  ['UI components', 'chips, autocomplete, dialog, treeview, accordion, badge, button, card, etc.'],
  ['Charts', 'apexcharts demos'],
  ['Forms / Tables', 'reactive form demos, datatable demos, basic-tables'],
  ['Theme', 'account settings template, FAQ, breadcrumbs, treeview'],
  ['Marketing', 'front-pages, landingpage, starter'],
  ['Dashboards', 'dashboard1, 2, 3, eCommerce, CRM dashboard, sales dashboard, etc.'],
];

const summaryRows = [
  ['~31', 'Real CRM modules (Full or Backend-only)'],
  ['8', 'Inventory backend modules (2 with UI: Suppliers + Tenant Settings)'],
  ['7', 'CRM frontend stubs awaiting backends (Companies, Customers, Bookings, Packages, Destinations, Pipeline, Reports)'],
  ['Every module', 'Multi-tenant + permissioned + audited from day one'],
];

// ── Build the document ───────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);

const children = [
  // Title block
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({
      text: 'TravelCRMPlus',
      bold: true, size: 44, color: '1F3A93',
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({
      text: 'Implemented Modules',
      bold: true, size: 36, color: '0F172A',
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 280 },
    children: [new TextRun({
      text: `As of ${today}`,
      italics: true, size: 22, color: '64748B',
    })],
  }),

  new Paragraph({
    spacing: { after: 180 },
    children: [new TextRun({
      text: 'This document inventories the modules currently implemented in TravelCRMPlus. ' +
            'Each row indicates whether the module is full-stack (backend + frontend wired), backend-only, ' +
            'frontend-only, or a hook for future implementations. Theme demo pages that ship with the ' +
            'SpikeAdmin baseline are listed in the final section for completeness.',
      size: 22,
    })],
  }),

  sectionHeading('1. Identity & Access'),
  sectionIntro('Authentication, users, roles, departments, permissions, and self-service profile management.'),
  moduleTable(identityRows),

  ...spacer(),
  sectionHeading('2. Platform Admin'),
  sectionIntro('Platform-scoped tools available to Platform Admins only. Tenant Admins do not see these.'),
  moduleTable(platformRows),

  ...spacer(),
  sectionHeading('3. Tenant Settings'),
  sectionIntro('Per-tenant configuration. Admin-only within each tenant.'),
  moduleTable(tenantSettingsRows),

  ...spacer(),
  sectionHeading('4. CRM (Sales & Operations)'),
  sectionIntro('Customer-facing business modules. Four are full-stack; seven are frontend-only stubs ' +
               'awaiting backend implementation.'),
  moduleTable(crmRows),

  ...spacer(),
  sectionHeading('5. Inventory Foundation'),
  sectionIntro('Generic inventory primitives that future sub-projects (Hotel, Vehicle, Driver, Guide) ' +
               'will extend with their own typed pricing and allotment strategies.'),
  moduleTable(inventoryRows),

  ...spacer(),
  sectionHeading('6. Infrastructure (cross-cutting)'),
  sectionIntro('Not user-facing — these concerns underpin every module above.'),
  twoColTable(infraRows),

  ...spacer(),
  sectionHeading('7. SpikeAdmin Theme Demos'),
  sectionIntro('Kept in the repo for visual reference. These routes exist but are not wired to any real ' +
               'backend and are not part of the CRM feature surface.'),
  twoColTable(themeRows, ['Category', 'Pages']),

  ...spacer(),
  sectionHeading('Summary'),
  twoColTable(summaryRows, ['Count', 'Detail'], [1800, 8280]),

  ...spacer(2),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: 'Generated from src tree on ' + today + ' — TravelCRMPlus internal documentation.',
      italics: true, size: 18, color: '94A3B8',
    })],
  }),
];

const doc = new Document({
  creator: 'TravelCRMPlus',
  title: 'TravelCRMPlus — Implemented Modules',
  description: 'Inventory of implemented modules with backend/frontend status.',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Arial', size: 30, bold: true, color: '1F3A93' },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({
            text: 'TravelCRMPlus — Implemented Modules',
            size: 18, color: '94A3B8',
          })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Page ', size: 18, color: '94A3B8' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '94A3B8' }),
            new TextRun({ text: ' of ', size: 18, color: '94A3B8' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '94A3B8' }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, 'implemented-modules.docx');
  fs.writeFileSync(out, buf);
  console.log(`Wrote ${out} (${buf.length.toLocaleString()} bytes)`);
});
