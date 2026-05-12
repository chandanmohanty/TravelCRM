// Generates docs/znicrm-feature-parity-plan.docx — formatted Word version of
// the ZNICRM feature-parity execution plan. Mirrors the structure of the
// markdown sibling (znicrm-feature-parity-plan.md).

const fs = require('fs');
const path = require('path');

const docxPath = path.join(process.env.APPDATA || '', 'npm/node_modules/docx');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, Header, Footer,
} = require(docxPath);

// ── Style helpers ─────────────────────────────────────────────────────────

const border = (color = 'CCCCCC') => ({ style: BorderStyle.SINGLE, size: 4, color });
const cellBorders = { top: border(), bottom: border(), left: border(), right: border() };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

const PAGE_WIDTH  = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN      = 1080;
const CONTENT     = PAGE_WIDTH - 2 * MARGIN; // 10080

// ── Cell builders ─────────────────────────────────────────────────────────

function headerCell(width, text) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders, margins: cellMargins,
    shading: { fill: '1F3A93', type: ShadingType.CLEAR, color: 'auto' },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 })],
    })],
  });
}

function bodyCell(width, text, opts = {}) {
  const runs = (Array.isArray(text) ? text : [text]).map(t =>
    typeof t === 'object' ? new TextRun(t) : new TextRun({ text: t, size: 18 }));
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders, margins: cellMargins,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: [new Paragraph({ children: runs })],
  });
}

function statusCell(width, status) {
  const map = {
    'Present': { fill: 'D4F4DD', color: '14532D' },
    'Partial': { fill: 'FEF3C7', color: '78350F' },
    'Missing': { fill: 'FFE4E6', color: '7F1D1D' },
  };
  const cfg = map[status] || { fill: 'F1F5F9', color: '475569' };
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders, margins: cellMargins,
    shading: { fill: cfg.fill, type: ShadingType.CLEAR, color: 'auto' },
    children: [new Paragraph({
      children: [new TextRun({ text: status, bold: true, color: cfg.color, size: 18 })],
    })],
  });
}

// 3-col gap-analysis table: Feature | Status | Notes
function gapTable(rows) {
  const cols = [3600, 1100, 5380];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell(cols[0], 'ZNICRM Feature'),
      headerCell(cols[1], 'Status'),
      headerCell(cols[2], 'Notes'),
    ],
  });
  const bodyRows = rows.map(r => new TableRow({
    children: [
      bodyCell(cols[0], r.feature),
      statusCell(cols[1], r.status),
      bodyCell(cols[2], r.notes || ''),
    ],
  }));
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: cols,
    rows: [headerRow, ...bodyRows],
  });
}

// 2-col table
function twoColTable(rows, headers, widths) {
  widths = widths || [3200, 6880];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [headerCell(widths[0], headers[0]), headerCell(widths[1], headers[1])],
  });
  const bodyRows = rows.map(r => new TableRow({
    children: [bodyCell(widths[0], r[0]), bodyCell(widths[1], r[1])],
  }));
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...bodyRows],
  });
}

// 4-col plan table
function planTable(rows) {
  const cols = [1800, 2200, 1400, 4680];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell(cols[0], 'Tier'),
      headerCell(cols[1], 'Price (annual)'),
      headerCell(cols[2], 'Storage'),
      headerCell(cols[3], 'Headline features'),
    ],
  });
  const bodyRows = rows.map(r => new TableRow({
    children: [
      bodyCell(cols[0], [new TextRun({ text: r[0], bold: true, size: 18 })]),
      bodyCell(cols[1], r[1]),
      bodyCell(cols[2], r[2]),
      bodyCell(cols[3], r[3]),
    ],
  }));
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: cols,
    rows: [headerRow, ...bodyRows],
  });
}

// Effort summary table
function effortTable(rows) {
  const cols = [3800, 1800, 1400, 3080];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell(cols[0], 'Phase'),
      headerCell(cols[1], 'Duration'),
      headerCell(cols[2], 'Story Points'),
      headerCell(cols[3], 'Sellable Increment'),
    ],
  });
  const bodyRows = rows.map(r => new TableRow({
    children: [
      bodyCell(cols[0], [new TextRun({ text: r[0], bold: true, size: 18 })]),
      bodyCell(cols[1], r[1]),
      bodyCell(cols[2], r[2]),
      bodyCell(cols[3], r[3]),
    ],
  }));
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: cols,
    rows: [headerRow, ...bodyRows],
  });
}

// ── Section helpers ───────────────────────────────────────────────────────

const spacer = (n = 1) => Array.from({ length: n }, () => new Paragraph({ children: [new TextRun('')] }));

const H1 = label => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 280, after: 140 },
  children: [new TextRun({ text: label, bold: true, size: 30, color: '1F3A93' })],
});

const H2 = label => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 200, after: 100 },
  children: [new TextRun({ text: label, bold: true, size: 24, color: '0F172A' })],
});

const H3 = label => new Paragraph({
  spacing: { before: 160, after: 80 },
  children: [new TextRun({ text: label, bold: true, size: 22, color: '334155' })],
});

const para = text => new Paragraph({
  spacing: { after: 120 },
  children: [new TextRun({ text, size: 20 })],
});

const bullet = text => new Paragraph({
  bullet: { level: 0 },
  spacing: { after: 60 },
  children: [new TextRun({ text, size: 20 })],
});

const intro = text => new Paragraph({
  spacing: { after: 160 },
  children: [new TextRun({ text, italics: true, size: 20, color: '475569' })],
});

const callout = (label, text) => new Paragraph({
  spacing: { after: 120 },
  children: [
    new TextRun({ text: label + ' ', bold: true, color: '1F3A93', size: 20 }),
    new TextRun({ text, size: 20 }),
  ],
});

// ── Data ──────────────────────────────────────────────────────────────────

const leadMgmtRows = [
  { feature: 'Leads CRUD', status: 'Present', notes: 'Features/Leads + UI' },
  { feature: 'Lead Distribution (auto-assign)', status: 'Missing', notes: 'Rule engine: round-robin, region, source, load' },
  { feature: 'Facebook Lead Ads → CRM', status: 'Missing', notes: 'OAuth + webhook handler' },
  { feature: 'Google Ads form submissions', status: 'Missing', notes: 'Conversion API + form handler' },
  { feature: 'IndiaMART feed', status: 'Missing', notes: 'Polling integration' },
  { feature: 'TradeIndia feed', status: 'Missing', notes: 'Polling integration' },
  { feature: 'WhatsApp inbound → lead', status: 'Partial', notes: 'Wati configured; need inbound webhook' },
  { feature: 'Web forms (Universal Contact Forms)', status: 'Missing', notes: 'Form builder + embed snippet' },
  { feature: 'Personal / Team Contact Forms', status: 'Missing', notes: 'Permission-scoped form ownership' },
];

const commsRows = [
  { feature: 'SMS Campaign / Bulk SMS', status: 'Missing', notes: 'SMS provider abstraction (Twilio, MSG91, Gupshup)' },
  { feature: 'Email Campaigns', status: 'Partial', notes: 'SMTP available; need campaign builder + audience' },
  { feature: 'WhatsApp Bulk Campaigning', status: 'Partial', notes: 'Wati available; need template bulk send' },
  { feature: 'Custom Gateways (Email/SMS)', status: 'Missing', notes: 'Provider strategy pattern' },
  { feature: 'WhatsApp 1-to-1 Chat', status: 'Missing', notes: 'Conversation thread UI' },
  { feature: 'Chat-Bots', status: 'Partial', notes: 'AI provider available; need flow designer' },
  { feature: 'Call Sync (Android)', status: 'Missing', notes: 'Mobile app + sync API' },
  { feature: 'Call Recording auto-upload', status: 'Missing', notes: 'Mobile app + storage hook' },
  { feature: 'Cloud Telephony', status: 'Missing', notes: 'Twilio/Exotel/Knowlarity/Tata Tele adapter' },
  { feature: 'Dialer System (click-to-call, auto)', status: 'Missing', notes: 'Browser softphone or telephony bridge' },
];

const pipelineRows = [
  { feature: 'Deals + pipeline stages', status: 'Partial', notes: 'UI stub exists, no entity' },
  { feature: 'Proposals / Quotations', status: 'Missing', notes: 'Line items, totals, PDF' },
  { feature: 'Pipeline kanban view', status: 'Partial', notes: 'Kanban component exists in theme' },
  { feature: 'Followup Intelligence (AI)', status: 'Missing', notes: 'Scoring + recommended next action' },
  { feature: 'Deal Revival (AI)', status: 'Missing', notes: 'Stale deal scoring + nudge' },
  { feature: 'Checklists (per stage)', status: 'Missing', notes: 'Stage-template checklist engine' },
];

const workflowRows = [
  { feature: 'Workflow Rules', status: 'Missing', notes: 'Trigger → condition → action engine' },
  { feature: 'Marketing Automation Rules', status: 'Missing', notes: 'Time + event-based triggers' },
  { feature: 'Assignments (rule-based)', status: 'Missing', notes: 'Distinct from one-off assignment' },
  { feature: 'Escalations (time-based)', status: 'Missing', notes: 'SLA timers + recipient ladder' },
  { feature: 'Approvals (multi-step)', status: 'Missing', notes: 'Approval chain + delegation' },
];

const invoicingRows = [
  { feature: 'Invoice settings', status: 'Present', notes: 'Features/Settings/Invoice' },
  { feature: 'Quotes', status: 'Missing', notes: 'Entity + PDF + convert-to-invoice' },
  { feature: 'Invoices', status: 'Missing', notes: 'Entity + PDF + payment tracking' },
  { feature: 'Multiple Taxes', status: 'Missing', notes: 'Tax catalogue + line-item tax' },
  { feature: 'Auto Tax Application (geo)', status: 'Missing', notes: 'Region → tax rule mapping' },
  { feature: 'Receipts', status: 'Missing', notes: 'Payment record + email' },
  { feature: 'Payment Gateway Integration', status: 'Missing', notes: 'Razorpay / Stripe / PayU adapter' },
  { feature: 'Subscriptions (recurring billing)', status: 'Missing', notes: 'Recurring schedule + auto-invoice' },
];

const inventoryRows = [
  { feature: 'Manage Products (categories + items)', status: 'Partial', notes: 'TravelCRM has travel inventory; generic SKU missing' },
  { feature: 'Manage Stocks', status: 'Partial', notes: 'Holds/Calendar exist for travel' },
  { feature: 'Vendor Management', status: 'Present', notes: 'Suppliers covers it' },
  { feature: 'Purchase Orders', status: 'Missing', notes: 'PO lifecycle entity' },
];

const helpdeskRows = [
  { feature: 'Support Panel (customer portal)', status: 'Missing', notes: 'Public-facing ticket creation' },
  { feature: 'Email-to-Ticket', status: 'Missing', notes: 'IMAP parser → ticket' },
  { feature: 'Knowledge Base', status: 'Missing', notes: 'Articles + search + public site' },
  { feature: 'Custom Domain for support', status: 'Missing', notes: 'Wildcard DNS + cert automation' },
];

const integrationsRows = [
  { feature: 'Zapier / Integrately', status: 'Missing', notes: 'Outbound webhooks + Zapier app' },
  { feature: 'Facebook Ads OAuth', status: 'Missing', notes: 'Token storage + webhook' },
  { feature: 'Google Ads OAuth', status: 'Missing', notes: 'Token + Conversion API' },
  { feature: 'Shopify', status: 'Missing', notes: 'Webhook + cart sync' },
  { feature: 'Webhooks (outbound)', status: 'Missing', notes: 'Subscriber model + retry' },
  { feature: 'Custom Integration framework', status: 'Missing', notes: 'Plug-in pattern' },
];

const widgetRows = [
  { feature: 'Embeddable JS widget', status: 'Missing', notes: 'Standalone Web Component bundle' },
  { feature: 'Auto Pop-up Contact Form', status: 'Missing', notes: 'Widget feature' },
  { feature: 'Splash Image / Exit Intent / Deal Bar', status: 'Missing', notes: 'Widget feature' },
  { feature: 'Cookie Notification', status: 'Missing', notes: 'Widget feature' },
  { feature: 'Visit tracking (Monthly Hits)', status: 'Missing', notes: 'Analytics ingest' },
];

const aiRows = [
  { feature: 'AI Credits system', status: 'Missing', notes: 'Token metering + wallet' },
  { feature: 'AI Chatbot for Website', status: 'Partial', notes: 'AI provider exists; need chat flow engine' },
  { feature: 'WhatsApp AI Chatbot', status: 'Partial', notes: 'Wati + AI provider; need orchestration' },
  { feature: 'Followup Intelligence', status: 'Missing', notes: 'Lead-scoring model + UI surface' },
  { feature: 'Deal Revival', status: 'Missing', notes: 'Stale-deal detection + revival prompts' },
];

const reportsRows = [
  { feature: 'Custom Reports builder', status: 'Partial', notes: 'UI stub at pages/crm/reports' },
  { feature: 'Manager dashboards', status: 'Missing', notes: 'Per-role aggregated views' },
  { feature: 'Standard reports (conversion, ROI, velocity)', status: 'Missing', notes: 'Pre-canned report library' },
];

const billingRows = [
  { feature: 'Plan tiers (Free/Starter/Grow/Scale/Business/Unlimited)', status: 'Partial', notes: 'Plans concept exists in Platform Admin' },
  { feature: 'Feature gating per plan', status: 'Missing', notes: 'Feature-flag map + middleware' },
  { feature: 'Per-user seat limits', status: 'Missing', notes: 'Enforce at user creation' },
  { feature: 'Document storage quota', status: 'Missing', notes: 'Per-tenant byte counter' },
  { feature: 'Rule-count limits', status: 'Missing', notes: 'Webhooks/workflow caps' },
  { feature: 'Trial period', status: 'Missing', notes: '30-day trial with expiry' },
  { feature: 'Billing portal', status: 'Missing', notes: 'Self-serve plan management' },
];

const planRows = [
  ['Free / Explore',  '₹0',           '1 GB',       'Lead capture, contacts, basic pipeline, max 3 users'],
  ['Starter',         '₹249/user',    '1 GB',       '+ Lead source integrations, call sync, deals, proposals'],
  ['Grow (Popular)',  '₹499/user',    '5 GB',       '+ Web/WhatsApp capture, bulk campaigns, workflows, quotes/invoices, checklists'],
  ['Scale',           '₹750/user',    '10 GB',      '+ Helpdesk, follow-up intelligence, dialer, deal revival, advanced automation'],
  ['Business Suite',  '₹1,250/user',  '25 GB',      '+ Approvals, escalations, custom domain, field-team visibility (50 users)'],
  ['Unlimited',       '₹14,999/mo',   'Unlimited',  'All Business features + dedicated support'],
];

const effortRows = [
  ['Phase 0 — Subscriptions & Feature Gating', '2–3 wk', '15 SP', 'Foundation'],
  ['Phase 1 — Deals & Pipeline',               '3–4 wk', '25 SP', 'Starter MVP'],
  ['Phase 2 — Companies & Customers',          '2–3 wk', '15 SP', 'Starter complete'],
  ['Phase 3 — Quotes & Invoices',              '3–4 wk', '30 SP', 'Grow blocks unlock'],
  ['Phase 4 — Lead Source Integrations',       '3–4 wk', '35 SP', 'Starter parity with ZNICRM'],
  ['Phase 5 — Contact Forms + Website Widget', '4–5 wk', '50 SP', 'Grow parity'],
  ['Phase 6 — Campaign Engine',                '4–5 wk', '45 SP', 'Grow complete'],
  ['Phase 7 — Workflow Automation Engine',     '4–6 wk', '60 SP', 'Grow / Scale unlock'],
  ['Phase 8 — Assignments / Escalations / Approvals', '2–3 wk', '25 SP', 'Business unlock'],
  ['Phase 9 — Cloud Telephony & Dialer',       '4–6 wk', '50 SP', 'Scale parity'],
  ['Phase 10 — Helpdesk & Knowledge Base',     '4–5 wk', '50 SP', 'Scale parity'],
  ['Phase 11 — Integrations (Webhooks/Zapier)','2–3 wk', '20 SP', 'Cross-tier'],
  ['Phase 12 — AI Features',                   '5–7 wk', '70 SP', 'Scale / Business'],
  ['Phase 13 — Reports & Analytics',           '3–4 wk', '30 SP', 'All tiers'],
  ['Phase 14 — Custom Domains & Billing UX',   '2–3 wk', '25 SP', 'Business complete'],
];

const riskRows = [
  ['WhatsApp template approval delays (Wati / Meta)', 'High', 'Medium', 'Submit templates 2 weeks before launch; pre-approve fallbacks'],
  ['Telephony provider regional restrictions',         'Medium', 'Medium', 'Adapter abstraction to swap providers per region'],
  ['AI cost runaway from misbehaving agents',          'Medium', 'High',   'Per-tenant token cap + circuit breaker + per-feature cap'],
  ['Custom domain SSL automation (LE rate limits)',    'Medium', 'Medium', 'Use ACME staging in dev; pre-warm certs at provisioning'],
  ['Plan migration of existing tenants',               'High',   'Low',    'Default existing tenants to 90-day Unlimited trial'],
  ['Perf regression from FeatureGate / global filters','Medium', 'High',   'Cache entitlements per-request; benchmark in CI'],
  ['Workflow rule infinite loops',                     'Medium', 'High',   'Per-event depth limit + circular-dependency check at save'],
];

const phaseDetails = [
  {
    title: 'Phase 0 — Subscriptions, Plans & Feature Gating (2–3 weeks)',
    why: 'Every later phase reads IFeatureGate.IsEntitled(feature). Building this last would force a retrofit across all phases.',
    backend: [
      'Features/Subscriptions/ MediatR module: Plan entity, TenantSubscription entity, FeatureGate service',
      '[RequiresFeature] action filter — 402 Payment Required if not entitled',
      'Seed the 6 plans with feature-to-plan mapping (config-driven)',
      'Trial-expiry Hangfire job (nightly): downgrade to past_due on expiry',
      'Migration: add seat_limit, storage_used_bytes columns to tenants',
    ],
    frontend: [
      'pages/platform-admin/plans/ — Platform Admin CRUD for plans + feature toggles',
      'pages/settings/subscription/ — Tenant Admin view of plan + upgrade button + usage meters',
      'core/services/entitlements.service.ts — caches /api/me/entitlements',
      '*hasFeature structural directive for UI feature gating',
    ],
    mt: 'Existing features (Leads, Tasks, Reminders, Suppliers) get featureCode = "core_crm" and are entitled in every plan.',
    effort: '15 SP',
  },
  {
    title: 'Phase 1 — Deals & Pipeline (3–4 weeks)',
    why: 'Pipeline is the heart of every CRM. ZNICRM\'s USP is "execution-focused" — this is it.',
    backend: [
      'Deal entity (lead FK, customer FK, stage, value, currency, expected close, owner)',
      'PipelineStage per-tenant configurable list',
      'deals/{id}/move endpoint with stage-change audit',
      'DealActivity log',
    ],
    frontend: [
      'pages/crm/pipeline/ — kanban board (drag stage), filter by owner/stage',
      'pages/crm/deals/ — list + detail (replaces stub)',
      'Deal-from-Lead conversion flow',
    ],
    mt: 'Pipeline stages are per-tenant configurable; standard tenant scoping.',
    effort: '25 SP',
  },
  {
    title: 'Phase 2 — Companies, Customers, Contacts (2–3 weeks)',
    why: 'Deals need a customer record. Both are currently frontend stubs.',
    backend: [
      'Company entity (name, industry, size, address)',
      'Customer (contact) entity (name, email, phone, company FK, owner)',
      'Lead-to-customer conversion endpoint',
      'Dedupe by email/phone',
    ],
    frontend: [
      'Wire up pages/crm/companies/ and pages/crm/customers/',
      'Inline create-company from customer form',
    ],
    mt: 'Standard tenant scoping.',
    effort: '15 SP',
  },
  {
    title: 'Phase 3 — Quotes & Invoices (3–4 weeks)',
    backend: [
      'Quote entity (line items, discount, tax, total, status, valid-until)',
      'Invoice entity (line items, tax breakdown, paid amount, status)',
      'TaxRule entity (rate, jurisdiction, applies to product category)',
      'PDF generation via QuestPDF',
      'Email-quote / email-invoice via existing SMTP',
      'Convert-quote-to-invoice flow',
    ],
    frontend: [
      'pages/crm/quotes/ + pages/crm/invoices/',
      'PDF preview pane',
      'Settings → Tax rules CRUD',
    ],
    mt: 'TaxRule tenant-scoped; PDF templates use existing tenant brand settings.',
    effort: '30 SP',
  },
  {
    title: 'Phase 4 — Lead Source Integrations (3–4 weeks)',
    backend: [
      'LeadSource entity (channel, credentials, last sync)',
      'Adapter pattern: Facebook Lead Ads (webhook), Google Ads (Conversion API), IndiaMART (poll), TradeIndia (poll), Wati inbound',
      'Hangfire job per polling adapter',
      'Webhook endpoint /api/lead-sources/webhook/{channel} with HMAC verification',
    ],
    frontend: [
      'pages/settings/lead-sources/ — connect/disconnect each channel, OAuth flows',
      'Lead detail shows source + raw payload',
    ],
    mt: 'Plan gating: Starter = manual only; Grow+ = Web + WhatsApp; Business = all sources.',
    effort: '35 SP',
  },
  {
    title: 'Phase 5 — Universal Contact Forms + Website Widget (4–5 weeks)',
    why: 'ZNIEngage equivalent — standalone embeddable widget separate from the main app.',
    backend: [
      'ContactForm entity (fields JSON schema, redirect URL, captcha config)',
      'FormSubmission entity → auto-creates a Lead',
      'WidgetSession (anonymous visitor) tracked by cookie',
      'Public endpoint /public/widget/{publicKey}/submit (rate-limited)',
    ],
    frontend: [
      'NEW separate Angular sub-app at widget/ → single widget.js (≤60 KB gzipped)',
      'Web Components: <znw-form>, <znw-popup>, <znw-deal-bar>, <znw-splash>, <znw-exit-intent>, <znw-cookie-banner>',
      'pages/settings/forms/ — form builder',
      'pages/settings/widget/ — toggle features, copy embed snippet',
    ],
    mt: 'All widget features Grow+; analytics gated by Monthly Unique Hits (10K Starter → 1M Business).',
    effort: '50 SP',
  },
  {
    title: 'Phase 6 — Campaign Engine (Email + SMS + WhatsApp Bulk) (4–5 weeks)',
    backend: [
      'Campaign entity (channel, audience segment, template, schedule, status)',
      'CampaignRecipient (per-customer send state)',
      'Audience query DSL → JSONLogic compiled to LINQ',
      'MessageTemplate (channel-specific; WhatsApp uses approved Wati templates)',
      'Channel adapters: EmailSender (SMTP), SmsSender (Twilio/MSG91/Gupshup), WhatsAppSender (Wati)',
      'Hangfire fan-out: 1 campaign → N rate-limited send jobs',
    ],
    frontend: [
      'pages/crm/campaigns/ — campaign builder (audience filter, template, schedule)',
      'Real-time delivery dashboard (delivered/opened/clicked)',
    ],
    mt: 'Grow+ = bulk campaigns; Starter = 1-to-1 only.',
    effort: '45 SP',
  },
  {
    title: 'Phase 7 — Workflow Automation Engine (4–6 weeks)',
    why: 'Big-ticket item — powers most of ZNICRM\'s "automation" sells.',
    backend: [
      'WorkflowRule entity (trigger, conditions, actions, enabled)',
      'Triggers: LeadCreated, LeadStageChanged, DealStageChanged, TaskOverdue, TimeElapsed, IncomingMessage',
      'Conditions: JSONLogic against the entity (nested AND/OR)',
      'Actions: SendEmail, SendWhatsApp, CreateTask, AssignTo, MoveStage, Webhook',
      'Domain event bus (IDomainEventDispatcher) — WorkflowEngine subscribes and matches',
      'Hangfire delayed jobs for time-based triggers',
    ],
    frontend: [
      'pages/settings/workflows/ — visual rule builder',
      'Execution log per rule with replay',
    ],
    mt: 'Grow = 10 rules, Scale = 20, Business = 30.',
    effort: '60 SP',
  },
  {
    title: 'Phase 8 — Assignments, Escalations & Approvals (2–3 weeks)',
    why: 'Built on Phase 7 — specialised action types + UIs.',
    backend: [
      'AssignmentRule (round-robin within team, by region, by source, by load)',
      'EscalationPolicy (if X not done in Y hours, escalate)',
      'Approval entity (request type, current step, chain, status)',
      'All three reuse WorkflowRule infrastructure with curated UIs',
    ],
    frontend: [
      'pages/settings/assignments/, /escalations/, /approvals/',
      'Approval inbox in user dashboard',
    ],
    mt: 'Business+ only.',
    effort: '25 SP',
  },
  {
    title: 'Phase 9 — Cloud Telephony, Call Sync & Dialer (4–6 weeks)',
    backend: [
      'TelephonyProvider entity (Twilio / Exotel / Knowlarity / Tata Tele)',
      'Provider adapters (outbound + recording webhook)',
      'CallLog entity (linked to customer/lead/deal, direction, duration, recording URL)',
      'Inbound webhook from each provider',
      'Click-to-call endpoint',
    ],
    frontend: [
      'pages/settings/telephony/ — provider config',
      'In-page softphone widget (WebRTC if available)',
      'Call log on every customer/lead/deal record',
      'Recordings inline-player',
    ],
    mt: 'Starter = call sync only; Grow = recording visibility; Scale+ = dialer + telephony.',
    effort: '50 SP',
  },
  {
    title: 'Phase 10 — Helpdesk & Knowledge Base (4–5 weeks)',
    backend: [
      'Ticket entity (subject, body, status, priority, customer FK, owner, SLA timer)',
      'TicketComment (public/private replies)',
      'Email-to-Ticket via IMAP poller (Hangfire)',
      'KnowledgeArticle entity (title, body, category, public slug)',
      'Public ticket portal at support.{tenant}.travelcrm.app',
      'Public KB at help.{tenant}.travelcrm.app',
    ],
    frontend: [
      'pages/crm/tickets/ — agent inbox',
      'pages/settings/knowledge-base/ — article CMS',
      'Public portal sub-app (separate bundle)',
    ],
    mt: 'Scale+ only.',
    effort: '50 SP',
  },
  {
    title: 'Phase 11 — Integrations: Webhooks, Zapier, Custom (2–3 weeks)',
    backend: [
      'WebhookSubscription entity (events, URL, secret, retry policy)',
      'Event bus → webhook dispatcher (Hangfire retry queue)',
      'Zapier integration: triggers + actions exposed via REST for Zapier\'s app definition',
      'Generic OAuth2 client registration table for custom integrations',
    ],
    frontend: [
      'pages/settings/webhooks/ — subscriptions, test fire, recent deliveries',
    ],
    mt: 'Grow=5, Scale=10, Business=25 webhooks.',
    effort: '20 SP',
  },
  {
    title: 'Phase 12 — AI Features (5–7 weeks)',
    why: 'Leverage existing Features/Settings/AiProvider — configs already in place.',
    backend: [
      'AiCreditWallet per tenant (token balance, usage log)',
      'Features/AiAgents/: Followup Intelligence, Deal Revival, Lead Qualifier Bot, AI Reply Suggestions',
      'All routes through IAiProviderClient abstraction',
      'Token metering middleware — debit AiCreditWallet',
    ],
    frontend: [
      'pages/crm/ai-insights/ — Followup Intelligence + Deal Revival dashboards',
      'Inline AI suggestions in lead/deal/customer detail',
      'pages/settings/ai/ extended with wallet balance + usage chart',
    ],
    mt: 'Scale = Followup Intelligence + Deal Revival; Business = + chatbots + reply suggestions. AI credits sold separately (₹1 = 1 AIC).',
    effort: '70 SP',
  },
  {
    title: 'Phase 13 — Reports & Analytics (3–4 weeks)',
    backend: [
      'ReportDefinition entity (filter JSON, columns, schedule)',
      'Standard reports: Conversion funnel, Source ROI, Sales velocity, Team performance, Pipeline forecast',
      'CSV/Excel export via EPPlus',
      'Scheduled email delivery (re-uses Campaign engine)',
    ],
    frontend: [
      'pages/crm/reports/ — wire up the stub',
      'ApexCharts dashboards',
      'Report builder (column picker, filter UI)',
      'Manager-only team performance views (permission-gated)',
    ],
    mt: 'Scale+ for custom reports; standard reports in Starter+.',
    effort: '30 SP',
  },
  {
    title: 'Phase 14 — Polish: Custom Domains, Storage Quotas, Billing UX (2–3 weeks)',
    backend: [
      'TenantDomain mapping + Let\'s Encrypt automation',
      'Per-tenant storage byte counter (in FileStorage.SaveAsync / DeleteAsync)',
      'Stripe / Razorpay subscription adapter → TenantSubscription.Status',
      'Self-serve billing portal endpoints',
    ],
    frontend: [
      'pages/settings/billing/ — invoices history, payment method, plan upgrade with Stripe Checkout',
      'Storage usage meter on dashboard',
    ],
    mt: 'Business+ unlocks custom domains.',
    effort: '25 SP',
  },
];

// ── Build document ────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);

const children = [];

// Title block
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text: 'TravelCRMPlus', bold: true, size: 44, color: '1F3A93' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: 'ZNICRM Feature-Parity', bold: true, size: 36, color: '0F172A' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: 'Execution Plan', bold: true, size: 32, color: '0F172A' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 280 },
    children: [new TextRun({ text: `Draft v1 — ${today}`, italics: true, size: 22, color: '64748B' })],
  }),
);

// 1. Executive Summary
children.push(H1('1. Executive Summary'));
children.push(para(
  'ZNICRM offers a tiered SaaS CRM (Free → Starter ₹249 → Grow ₹499 → Scale ₹750 → Business ₹1,250 → Unlimited ₹14,999/mo) with about 80 distinct features spanning lead capture, multi-channel communication, pipeline automation, invoicing, ticketing, inventory, AI, and a website widget.'
));
children.push(para(
  'TravelCRMPlus already has a strong multi-tenant foundation with ~31 implemented modules covering identity, platform admin, tenant settings, leads, tasks, reminders, and inventory primitives. The remaining work is building the customer-facing CRM surface, communication channels, automation engine, and SaaS billing/feature-gating — all on top of the existing infrastructure.'
));
children.push(callout('Estimated total scope:', '14 phases over 12–18 months with a 3–5 engineer team. The plan is structured so each phase ships a coherent, sellable slice — early phases unlock a working Starter-equivalent plan; the final phases reach Business Suite parity.'));

// 2. Current State
children.push(H1('2. Current TravelCRM Architecture Snapshot'));
children.push(intro('Strengths to build on (not re-build). The infra is production-grade.'));
children.push(twoColTable([
  ['Auth & Identity', 'Login, JWT refresh, forgot/reset password, users, roles, departments, permissions catalogue — FULL'],
  ['Platform Admin', 'Tenant CRUD, dashboard, brand, configs, data reset — FULL'],
  ['Tenant Settings', 'Brand, system, invoice, SMTP, WhatsApp (Wati), file storage (local + S3), AI provider, locale, scheduled tasks, task types — FULL'],
  ['CRM (existing)', 'Leads, Tasks, Time Entries, Reminders — FULL. Companies/Customers/Bookings/Packages/Destinations/Pipeline/Reports — frontend stubs'],
  ['Inventory Foundation', 'Suppliers FULL; Resources / Calendar / Holds backend complete; pricing strategy hook'],
  ['Cross-cutting', 'Multi-tenancy (subdomain or header), JWT, API envelope, FluentValidation + MediatR, audit logging, correlation ID, Hangfire (heartbeat / overdue / hold-expiry), Serilog → console+file+Seq, PostgreSQL/EF Core'],
], ['Area', 'Status']));

children.push(spacer()[0]);
children.push(H2('Why this plan stays small'));
children.push(bullet('No need to rebuild infra — auth, tenancy, audit, jobs, storage are production-grade.'));
children.push(bullet('AI provider configs already exist (Anthropic + others) — every AI feature can land without new config plumbing.'));
children.push(bullet('WhatsApp (Wati) is already wired — engagement layer just needs UI + campaign engine on top.'));
children.push(bullet('Hangfire already runs recurring jobs — automation rules use the same scheduler.'));
children.push(bullet('Biggest greenfield areas: Deals/Pipeline, Quotes/Invoices, Campaign engine, Workflow automation, Website widget, AI agents, SaaS billing layer.'));

// 3. Gap Analysis
children.push(H1('3. ZNICRM Feature Catalogue — Gap Analysis'));
children.push(intro('Each ZNICRM feature mapped against the current TravelCRM state. Present = fully implemented; Partial = infrastructure exists, feature layer missing; Missing = not started.'));

children.push(H2('3.1 Lead Management & Capture'));
children.push(gapTable(leadMgmtRows));

children.push(spacer()[0]);
children.push(H2('3.2 Communication & Engagement'));
children.push(gapTable(commsRows));

children.push(spacer()[0]);
children.push(H2('3.3 Sales Pipeline & Deals'));
children.push(gapTable(pipelineRows));

children.push(spacer()[0]);
children.push(H2('3.4 Workflow & Automation'));
children.push(gapTable(workflowRows));

children.push(spacer()[0]);
children.push(H2('3.5 Invoicing & Billing'));
children.push(gapTable(invoicingRows));

children.push(spacer()[0]);
children.push(H2('3.6 Inventory & Products'));
children.push(gapTable(inventoryRows));

children.push(spacer()[0]);
children.push(H2('3.7 Ticketing / Helpdesk'));
children.push(gapTable(helpdeskRows));

children.push(spacer()[0]);
children.push(H2('3.8 Integrations'));
children.push(gapTable(integrationsRows));

children.push(spacer()[0]);
children.push(H2('3.9 ZNIEngage (Website widget)'));
children.push(gapTable(widgetRows));

children.push(spacer()[0]);
children.push(H2('3.10 AI Features'));
children.push(gapTable(aiRows));

children.push(spacer()[0]);
children.push(H2('3.11 Reporting & Analytics'));
children.push(gapTable(reportsRows));

children.push(spacer()[0]);
children.push(H2('3.12 SaaS Billing & Plan Gating'));
children.push(gapTable(billingRows));

// 4. Multi-tenancy strategy
children.push(H1('4. Multi-Tenancy Strategy'));
children.push(para(
  'TravelCRM already enforces multi-tenancy via ITenantContext resolved from subdomain or header, with global EF query filters scoping every DbSet. New features extend this in three ways:'
));

children.push(H3('4.1 Tenant-Scoped Data'));
children.push(para('Every new entity (Deal, Quote, Invoice, Campaign, WorkflowRule, Webhook, KnowledgeArticle, Ticket, etc.) must:'));
children.push(bullet('Inherit ITenantOwned (or have a TenantId FK)'));
children.push(bullet('Be covered by the global query filter'));
children.push(bullet('Be audited via AuditSaveChangesInterceptor'));

children.push(H3('4.2 Plan-Gated Features (NEW infrastructure)'));
children.push(para('A new Features/Subscriptions module to track per-tenant entitlements: TenantSubscription with TenantId, PlanCode (free|starter|grow|scale|business|unlimited), Status (trial|active|past_due|cancelled), TrialEndsAt, CurrentPeriodEnd, SeatLimit, StorageGbLimit, WebhookLimit, WorkflowRuleLimit, …'));
children.push(para('A [RequiresFeature("WhatsAppBulkCampaign")] attribute on controllers + an IFeatureGate service resolves the tenant\'s plan → returns 402 Payment Required if not entitled.'));

children.push(H3('4.3 Per-Tenant Resource Limits'));
children.push(para('Quotas are enforced at two layers:'));
children.push(bullet('Soft (UI) — Angular reads /api/me/entitlements and disables the "Create" button + shows upgrade nudge when the limit is reached.'));
children.push(bullet('Hard (API) — Every Create command in MediatR validation checks the live count against the entitlement; rejects with a clear "limit reached" error before persisting.'));

children.push(H3('4.4 Tenant Provisioning Lifecycle'));
children.push(bullet('1. Create Tenant row.'));
children.push(bullet('2. Create TenantSubscription with Status=trial, PlanCode=starter (or free), TrialEndsAt=now+30d.'));
children.push(bullet('3. Seed the tenant\'s default workspace (default roles, default pipeline, default task types).'));
children.push(bullet('4. Hangfire job nightly: scan for trials ending in 3 days → send reminder email; on expiry → flip to past_due, suspend write access.'));

children.push(H3('4.5 Custom Domain per Tenant (Business Suite)'));
children.push(bullet('Wildcard DNS at the load balancer (*.travelcrm.app) — already works for subdomains.'));
children.push(bullet('Custom-domain support (e.g., crm.acme.com) requires: TenantDomain table mapping host → TenantId, Let\'s Encrypt cert automation, update TenantResolutionMiddleware to check TenantDomain table on cache-miss.'));

// 5. Plan tiers
children.push(H1('5. Proposed Plan Tiers for TravelCRM'));
children.push(intro('6 tiers mirroring ZNICRM, adapted for the travel-vertical. Each feature has a minimum tier; the FeatureGate service holds the mapping.'));
children.push(planTable(planRows));

// 6. Phased roadmap - effort summary
children.push(H1('6. Phased Execution Roadmap'));
children.push(intro('14 phases, each shipping a sellable increment. Effort in story points (1 SP ≈ 1 engineer-day). With 3 engineers in parallel, realistic ship: 12–14 months; with 5 engineers, 9–11 months.'));
children.push(effortTable(effortRows));

// 7. Phase details
children.push(spacer()[0]);
children.push(H1('7. Phase Details'));
children.push(intro('Each phase below specifies the backend, frontend, multi-tenant impact, and effort.'));

for (const ph of phaseDetails) {
  children.push(H2(ph.title));
  if (ph.why) children.push(callout('Why now:', ph.why));

  children.push(H3('Backend'));
  for (const b of ph.backend) children.push(bullet(b));

  children.push(H3('Frontend'));
  for (const f of ph.frontend) children.push(bullet(f));

  if (ph.mt) {
    children.push(H3('Multi-tenant impact'));
    children.push(para(ph.mt));
  }

  children.push(callout('Effort:', ph.effort));
  children.push(spacer()[0]);
}

// 8. Cross-cutting
children.push(H1('8. Cross-Cutting Concerns'));

children.push(H2('8.1 Feature Flags vs Plan Gates vs Tenant Settings'));
children.push(para('Three distinct concepts — keep them separate:'));
children.push(twoColTable([
  ['Plan Feature',   'Sold per tier — stored in Plan.featureCodes. Example: whatsapp_bulk_campaign'],
  ['Tenant Setting', 'Configured per tenant — stored in tenant_settings. Example: SMTP host, default currency'],
  ['Feature Flag',   'Engineering toggle (canary, kill-switch) — config or Unleash. Example: new_pipeline_kanban_v2'],
], ['Concept', 'Definition + example']));
children.push(para('A user-visible button is shown only if all three conditions are met: plan entitles it, tenant has configured it, feature flag is on.'));

children.push(H2('8.2 Plan-Limit Enforcement Pattern'));
children.push(para('Every Create handler checks the live count against the entitlement before persisting; the Angular service catches "plan_limit_reached:*" errors and shows the upgrade modal.'));

children.push(H2('8.3 Data Migration Discipline'));
children.push(bullet('One EF migration per phase, named YYYYMMDD_phaseN_*'));
children.push(bullet('Backfill scripts for existing tenants where a new column needs a default'));
children.push(bullet('Smoke test on a staging tenant before production migration'));

children.push(H2('8.4 Security Per Feature'));
children.push(bullet('Lead source webhooks: HMAC signatures per provider'));
children.push(bullet('Public widget endpoints: rate-limit per IP and per publicKey'));
children.push(bullet('Payment gateway webhooks: signed payload verification (Stripe/Razorpay HMAC)'));
children.push(bullet('Custom domains: ownership verification (DNS TXT record check before activation)'));
children.push(bullet('Every new permission added to PermissionCatalog; RolePermissionSeeder grants Admin by default'));

children.push(H2('8.5 Observability'));
children.push(bullet('Serilog scope Feature=<code> on each new feature for filtering in Seq'));
children.push(bullet('Hangfire dashboard exposes per-feature job queues'));
children.push(bullet('Prometheus metrics: per-tenant active users, campaign send rate, AI tokens consumed'));

// 9. Sequencing
children.push(H1('9. Critical Dependencies & Sequencing'));
children.push(bullet('Phase 0 must ship first. Every later phase reads IFeatureGate.'));
children.push(bullet('Phases 1 → 2 → 3 must stay in this order — invoices need customers, customers need deals.'));
children.push(bullet('Phase 7 (Workflow Engine) unblocks Phase 8 and is heavily used by Phases 4, 6, 9, 10, 12.'));
children.push(bullet('Phases 5 (widget), 10 (support portal), 14 (custom domain) all need the same wildcard-cert automation.'));
children.push(bullet('Phase 12 (AI) is parallelisable with everything from Phase 3 onwards.'));
children.push(bullet('Phases 4, 9 are integration-heavy — partner accounts (IndiaMART, FB, Twilio) must be procured before sprint start.'));

// 10. Risks
children.push(H1('10. Risk Register'));
children.push(twoColTable(
  riskRows.map(r => [r[0], `Likelihood: ${r[1]} | Impact: ${r[2]} — Mitigation: ${r[3]}`]),
  ['Risk', 'Profile + Mitigation']
));

// 11. DoD
children.push(H1('11. Definition of Done (per phase)'));
children.push(para('A phase is "Done" only when all of:'));
children.push(bullet('All entities have EF migrations + seed data'));
children.push(bullet('All endpoints have FluentValidation + permission attributes + integration tests'));
children.push(bullet('All UI screens are responsive (mobile + dark mode using existing token system)'));
children.push(bullet('Feature is gated by IFeatureGate at the API layer'));
children.push(bullet('Plan-limit counters increment correctly + a "limit reached" upgrade flow exists in UI'));
children.push(bullet('Permission catalog updated; RolePermissionSeeder grants Admin by default'));
children.push(bullet('Hangfire jobs (if any) have a dashboard tag and dead-letter queue'));
children.push(bullet('docs/implemented-modules.docx regenerated to reflect new modules'));
children.push(bullet('Graphify (graphify update .) run to keep the knowledge graph current'));
children.push(bullet('One demo tenant provisioned + smoke-tested by QA'));

// 12. Open questions
children.push(H1('12. Open Questions for Stakeholders'));
children.push(bullet('Target market — Indian travel agencies (₹ pricing, IndiaMART/TradeIndia priority) or global (USD, FB/Google priority)?'));
children.push(bullet('Field Force (TeamSpoor) — bundle as a Business-tier feature inside TravelCRMPlus, or keep as a sister product?'));
children.push(bullet('Travel-specific inventory (Hotels/Transport/Activity already built) — extend ZNICRM\'s generic Products module to merge, or keep them separate?'));
children.push(bullet('AI provider primary — Anthropic only (already configured) or multi-provider routing?'));
children.push(bullet('Mobile app — native iOS+Android, Capacitor wrapper, or web-only?'));
children.push(bullet('Payment gateways — Razorpay (India) + Stripe (global) — both from day one of Phase 14?'));
children.push(bullet('Domain mapping — self-serve in UI, or support-team-assisted for the first 6 months?'));

// Footer line
children.push(...spacer(2));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({
    text: 'This plan is a living document. After Phase 0 ships, refine with actual velocity and re-prioritise against customer feedback.',
    italics: true, size: 18, color: '94A3B8',
  })],
}));

// ── Document ──────────────────────────────────────────────────────────────

const doc = new Document({
  creator: 'TravelCRMPlus',
  title: 'TravelCRMPlus — ZNICRM Feature-Parity Execution Plan',
  description: 'Step-by-step execution plan to reach ZNICRM feature parity in TravelCRMPlus.',
  styles: {
    default: { document: { run: { font: 'Arial', size: 20 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Arial', size: 30, bold: true, color: '1F3A93' },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Arial', size: 24, bold: true, color: '0F172A' },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
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
            text: 'TravelCRMPlus — ZNICRM Feature-Parity Plan',
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
  const out = path.join(__dirname, 'znicrm-feature-parity-plan.docx');
  fs.writeFileSync(out, buf);
  console.log(`Wrote ${out} (${buf.length.toLocaleString()} bytes)`);
});
