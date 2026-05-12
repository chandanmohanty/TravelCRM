# TravelCRMPlus — ZNICRM Feature-Parity Execution Plan

> **Source document:** ZNICRM Pricing & Feature Catalogue (https://znicrm.com/pricing.php)
> **Target codebase:** TravelCRMPlus (multi-tenant, Angular 21 + ASP.NET Core 8 + PostgreSQL)
> **Date:** 2026-05-13
> **Status:** Draft v1 — for review and prioritisation

---

## 1. Executive Summary

ZNICRM offers a tiered SaaS CRM (Free → Starter ₹249 → Grow ₹499 → Scale ₹750 → Business ₹1,250 → Unlimited ₹14,999/mo) with **~80 distinct features** spanning lead capture, multi-channel communication, pipeline automation, invoicing, ticketing, inventory, AI, and a website widget.

TravelCRMPlus already has **a strong multi-tenant foundation** with **~31 implemented modules** covering identity, platform admin, tenant settings, leads, tasks, reminders, and inventory primitives. The remaining work is **building the customer-facing CRM surface, communication channels, automation engine, and SaaS billing/feature-gating** — all on top of the existing infrastructure.

**Estimated total scope:** 14 phases over **12–18 months** with a 3–5 engineer team. The plan is structured so each phase ships a coherent, sellable slice — early phases unlock a working "Starter"-equivalent plan; the final phases reach "Business Suite" parity.

---

## 2. Current TravelCRM Architecture Snapshot

### 2.1 What we already have (Full-stack)

| Area | Status |
|---|---|
| **Auth + Identity** (login, JWT refresh, forgot/reset password, users, roles, departments, permissions catalog) | ✅ Full |
| **Platform Admin** (tenant CRUD, platform dashboard, brand, configs, data reset) | ✅ Full |
| **Tenant Settings** (brand, system, invoice settings, SMTP, WhatsApp Wati, file storage local/S3, AI provider, locale, scheduled tasks, task types, inventory settings) | ✅ Full |
| **CRM** — Leads, Tasks, Time Entries, Reminders | ✅ Full |
| **Inventory Foundation** — Suppliers (full), Resources/Calendar/Holds (backend), Pricing hook | ✅ Backend + partial UI |
| **Cross-cutting infrastructure** — multi-tenancy (subdomain/header), JWT, API envelope, validation pipeline (FluentValidation + MediatR), audit logging, correlation ID, Hangfire jobs, Serilog → console+file+Seq, PostgreSQL/EF Core | ✅ Full |

### 2.2 What's a frontend stub awaiting backend

`pages/crm/companies`, `pages/crm/customers`, `pages/crm/bookings`, `pages/crm/packages`, `pages/crm/destinations`, `pages/crm/pipeline`, `pages/crm/reports` — these UI shells exist but have no API yet.

### 2.3 What this means for the plan

- **No need to rebuild infra** — auth, tenancy, audit, jobs, storage are production-grade.
- **AI provider configs already exist** (Anthropic + others) — every AI feature can land without new config plumbing.
- **WhatsApp (Wati) is already wired** — the engagement layer just needs the messaging UI and campaign engine on top.
- **Hangfire is already running recurring jobs** — automation rules will run on the same scheduler.
- **The biggest greenfield areas** are: Deals/Pipeline, Quotes/Invoices, Campaign engine, Workflow automation, Website widget, AI agents, and the SaaS billing layer.

---

## 3. ZNICRM Feature Catalogue (consolidated)

The 80+ features cluster into **13 functional domains**. For each row below, **Status** is the TravelCRM state today:

- ✅ **Present** — fully implemented
- 🟡 **Partial** — infrastructure exists, feature layer missing
- ❌ **Missing** — not started

### 3.1 Lead Management & Capture

| ZNICRM Feature | TravelCRM Status | Notes |
|---|---|---|
| Leads CRUD | ✅ Present | `Features/Leads` + UI |
| Lead Distribution (auto-assign) | ❌ Missing | Need rule engine (round-robin, region, source, owner load) |
| Facebook Lead Ads → CRM | ❌ Missing | OAuth + webhook handler |
| Google Ads form submissions | ❌ Missing | Conversion API + form handler |
| IndiaMART feed | ❌ Missing | Polling integration |
| TradeIndia feed | ❌ Missing | Polling integration |
| WhatsApp inbound → lead | 🟡 Partial | Wati configured; need inbound message webhook |
| Web forms (Universal Contact Forms) | ❌ Missing | Form builder + embed snippet |
| Personal / Team Contact Forms | ❌ Missing | Permission-scoped form ownership |

### 3.2 Communication & Engagement

| ZNICRM Feature | TravelCRM Status | Notes |
|---|---|---|
| SMS Campaign / Bulk SMS | ❌ Missing | Need SMS provider abstraction (Twilio, MSG91, Gupshup) |
| Email Campaigns | 🟡 Partial | SMTP available; need campaign builder + audience filters + scheduling |
| WhatsApp Bulk Campaigning | 🟡 Partial | Wati available; need template-based bulk send + Hangfire batching |
| Custom Gateways (Email/SMS) | ❌ Missing | Provider strategy pattern |
| WhatsApp 1-to-1 Chat | ❌ Missing | Conversation thread UI |
| Chat-Bots | 🟡 Partial | AI provider available; need conversation flow designer |
| Call Sync (Android) | ❌ Missing | Mobile app + sync API |
| Call Recording auto-upload | ❌ Missing | Mobile app + storage hook |
| Cloud Telephony integration | ❌ Missing | Adapter for Twilio/Exotel/Knowlarity/Tata Tele |
| Dialer System (click-to-call, auto-dial) | ❌ Missing | Browser softphone or telephony bridge |

### 3.3 Sales Pipeline & Deals

| ZNICRM Feature | TravelCRM Status | Notes |
|---|---|---|
| Deals + pipeline stages | 🟡 Partial | UI stub at `pages/crm/pipeline`, no entity |
| Proposals / Quotations | ❌ Missing | Line items, totals, PDF |
| Pipeline kanban view | 🟡 Partial | Kanban component exists in theme |
| Followup Intelligence (AI) | ❌ Missing | Scoring + recommended next action |
| Deal Revival (AI) | ❌ Missing | Stale deal scoring + nudge campaign |
| Checklists (per stage) | ❌ Missing | Stage-template checklist engine |

### 3.4 Workflow & Automation

| ZNICRM Feature | TravelCRM Status | Notes |
|---|---|---|
| Workflow Rules (trigger → condition → action) | ❌ Missing | Rule engine + Hangfire execution |
| Marketing Automation Rules (drip campaigns) | ❌ Missing | Time-based + event-based triggers |
| Assignments (rule-based) | ❌ Missing | Distinct from one-off assignment |
| Escalations (time-based) | ❌ Missing | SLA timers + recipient ladder |
| Approvals (multi-step) | ❌ Missing | Approval chain + delegation |

### 3.5 Invoicing & Billing

| ZNICRM Feature | TravelCRM Status | Notes |
|---|---|---|
| Invoice settings | ✅ Present | `Features/Settings/Invoice` |
| Quotes | ❌ Missing | Entity, PDF, convert-to-invoice |
| Invoices | ❌ Missing | Entity, PDF, payment tracking |
| Multiple Taxes | ❌ Missing | Tax catalogue + line-item tax |
| Auto Tax Application (geo-based) | ❌ Missing | Region → tax rule mapping |
| Receipts | ❌ Missing | Payment record + email |
| Payment Gateway Integration | ❌ Missing | Razorpay / Stripe / PayU adapter |
| Subscriptions (recurring) | ❌ Missing | Recurring schedule + auto-invoice |

### 3.6 Inventory & Products

| ZNICRM Feature | TravelCRM Status | Notes |
|---|---|---|
| Manage Products (categories + items) | 🟡 Partial | TravelCRM has *travel inventory* (Hotels, Transport, etc.) — generic product line missing |
| Manage Stocks | 🟡 Partial | Holds/Calendar exist for travel; SKU-based stock missing |
| Vendor Management | ✅ Present | `Suppliers` covers it |
| Purchase Orders | ❌ Missing | PO lifecycle entity |

### 3.7 Ticketing / Helpdesk

| ZNICRM Feature | TravelCRM Status | Notes |
|---|---|---|
| Support Panel (customer portal) | ❌ Missing | Public-facing ticket creation |
| Email-to-Ticket | ❌ Missing | IMAP parser → ticket |
| Knowledge Base | ❌ Missing | Articles + search + public site |
| Custom Domain for support | ❌ Missing | Wildcard DNS + cert automation |

### 3.8 Integrations

| ZNICRM Feature | TravelCRM Status | Notes |
|---|---|---|
| Zapier / Integrately | ❌ Missing | Outbound webhooks + Zapier app |
| Facebook Ads OAuth | ❌ Missing | Token storage + webhook |
| Google Ads OAuth | ❌ Missing | Token storage + Conversion API |
| Shopify | ❌ Missing | Webhook + cart sync |
| Webhooks (outbound) | ❌ Missing | Subscriber model + retry |
| Custom Integration framework | ❌ Missing | Plug-in pattern |

### 3.9 ZNIEngage (Website widget)

| ZNICRM Feature | TravelCRM Status | Notes |
|---|---|---|
| Embeddable JS widget | ❌ Missing | Standalone Web Component bundle |
| Auto Pop-up Contact Form | ❌ Missing | Widget feature |
| Splash Image | ❌ Missing | Widget feature |
| Exit Intent Popup | ❌ Missing | Widget feature |
| Deal Bar | ❌ Missing | Widget feature |
| Cookie Notification | ❌ Missing | Widget feature |
| Turn Text-to-Button | ❌ Missing | Widget feature |
| Visit tracking (Monthly Hits) | ❌ Missing | Analytics ingest |

### 3.10 AI Features

| ZNICRM Feature | TravelCRM Status | Notes |
|---|---|---|
| AI Credits system | ❌ Missing | Token metering + wallet |
| AI Chatbot for Website | 🟡 Partial | AI provider exists; need chat flow engine |
| WhatsApp AI Chatbot | 🟡 Partial | Wati + AI provider — need orchestration |
| Followup Intelligence | ❌ Missing | Lead-scoring model + UI surface |
| Deal Revival | ❌ Missing | Stale-deal detection + revival prompts |

### 3.11 Reporting & Analytics

| ZNICRM Feature | TravelCRM Status | Notes |
|---|---|---|
| Custom Reports builder | 🟡 Partial | UI stub at `pages/crm/reports` |
| Manager dashboards | ❌ Missing | Per-role aggregated views |
| Standard reports (conversion, source ROI, sales velocity) | ❌ Missing | Pre-canned report library |

### 3.12 SaaS Billing & Plan Gating *(transversal, but new)*

| ZNICRM Feature | TravelCRM Status | Notes |
|---|---|---|
| Plan tiers (Free / Starter / Grow / Scale / Business / Unlimited) | 🟡 Partial | Plans concept exists in Platform Admin |
| Feature gating per plan | ❌ Missing | Need feature-flag map + middleware |
| Per-user seat limits | ❌ Missing | Enforce at user creation |
| Document storage quota (1–25 GB) | ❌ Missing | Per-tenant byte counter |
| Rule-count limits (webhooks: 5/10/25; workflows: 10/20/30) | ❌ Missing | Enforced on create |
| Trial period | ❌ Missing | 30-day trial with expiry |
| Subscription state (active, past-due, cancelled, trial) | ❌ Missing | Per-tenant subscription record |
| Billing portal | ❌ Missing | Self-serve plan management |

### 3.13 Field Force (TeamSpoor — separate product line)

ZNICRM treats this as a separate product. **Out of scope for core CRM parity.** Consider as a future module under "Business Suite" tier only.

---

## 4. Multi-Tenancy Strategy

TravelCRM already enforces multi-tenancy via `ITenantContext` resolved from subdomain or header, with global EF query filters scoping every DbSet. The new features must extend this model in three ways:

### 4.1 Tenant-Scoped Data
Every new entity (Deal, Quote, Invoice, Campaign, WorkflowRule, Webhook, KnowledgeArticle, Ticket, etc.) **must**:
- Inherit `ITenantOwned` (or have `TenantId` FK)
- Be covered by the global query filter
- Be audited via `AuditSaveChangesInterceptor`

### 4.2 Plan-Gated Features (NEW infrastructure)
A new `Features/Subscriptions` module to track per-tenant entitlements:

```
TenantSubscription
├── TenantId
├── PlanCode      (free | starter | grow | scale | business | unlimited)
├── Status        (trial | active | past_due | cancelled)
├── TrialEndsAt
├── CurrentPeriodEnd
└── SeatLimit, StorageGbLimit, WebhookLimit, WorkflowRuleLimit, ...
```

A `[RequiresFeature("WhatsAppBulkCampaign")]` attribute on controllers + an `IFeatureGate` service resolves the tenant's plan → returns 402 Payment Required if not entitled.

### 4.3 Per-Tenant Resource Limits
Quotas are enforced at **two layers**:

1. **Soft (UI)** — Angular reads `/api/me/entitlements` and disables the "Create" button + shows an upgrade nudge when the limit is reached.
2. **Hard (API)** — Every `Create` command in MediatR validation checks the live count against the entitlement; rejects with a clear "limit reached" error before persisting.

### 4.4 Tenant Provisioning Lifecycle
When a tenant signs up:
1. Create `Tenant` row.
2. Create `TenantSubscription` with `Status=trial`, `PlanCode=starter` (or `free`), `TrialEndsAt=now+30d`.
3. Seed the tenant's default workspace (default roles, default pipeline, default task types).
4. Hangfire job nightly: scan for trials ending in 3 days → send reminder email; on expiry → flip to `past_due`, suspend write access.

### 4.5 Custom Domain per Tenant (Business Suite feature)
- Wildcard DNS at the load balancer (`*.travelcrm.app`) — already works for subdomains.
- Custom-domain support (e.g., `crm.acme.com`) requires:
  - `TenantDomain` table mapping `host → TenantId`
  - Let's Encrypt cert automation (cert-manager on K8s or a simple ACME background job)
  - Update `TenantResolutionMiddleware` to check `TenantDomain` table on cache-miss

---

## 5. Plan-Tier Mapping for TravelCRM

We propose **6 tiers** mirroring ZNICRM but adapted to the travel-vertical:

| Tier | Monthly (annual billed) | Seat cap | Storage | Headline features |
|---|---|---|---|---|
| **Free / Explore** | ₹0 | 3 users | 1 GB | Lead capture, contacts, basic pipeline, 1 admin |
| **Starter** | ₹249/user | unlimited | 1 GB | + Lead source integrations, call sync, deals, proposals, onboarding |
| **Grow** | ₹499/user | unlimited | 5 GB | + Web/WhatsApp capture, bulk campaigns, workflow automation, quotes, invoices, checklists |
| **Scale** | ₹750/user | unlimited | 10 GB | + Helpdesk, follow-up intelligence, dialer, deal revival, custom reports, advanced automation |
| **Business Suite** | ₹1,250/user | 50 users | 25 GB | + Approvals, escalations, assignments, field-team visibility, custom domain, priority support |
| **Unlimited** | ₹14,999/mo flat | unlimited | unlimited | All Business features + dedicated support |

Each feature has a **minimum tier**; the `FeatureGate` service holds the mapping.

---

## 6. Phased Execution Roadmap

The plan is **14 phases**, organised so each phase ships a sellable increment. Effort is given in **story points (1 SP ≈ 1 engineer-day)**; phase duration assumes a 3-engineer team.

### Phase 0 — Foundation: Subscription, Plans & Feature Gating *(2–3 weeks)*

**Why first:** every later feature must check `IFeatureGate.IsEntitled(feature)`. Building this last would force a retrofit across all phases.

**Backend:**
- `Features/Subscriptions/` MediatR module:
  - `Plan` entity (code, name, price, seat limit, storage limit, feature codes JSON)
  - `TenantSubscription` entity (tenant FK, plan code, status, trial dates, period dates)
  - `FeatureGate` service with `IsEntitled(tenantId, featureCode)`
  - `[RequiresFeature]` action filter that short-circuits 402
- Seed the 6 plans with feature-to-plan mapping (one giant config file or DB seed)
- Trial-expiry Hangfire job (nightly)
- Migration: add `seat_limit`, `storage_used_bytes`, etc. to `tenants`

**Frontend:**
- `pages/platform-admin/plans/` — Platform Admin CRUD for plans + feature toggles
- `pages/settings/subscription/` — Tenant Admin view of current plan + upgrade button + usage meters
- `core/services/entitlements.service.ts` — caches `/api/me/entitlements`; exposes `isEntitled()` for guards/directives
- `*hasFeature` structural directive for hiding UI behind a feature flag

**Multi-tenant impact:** Every existing controller is now wrapped by FeatureGate. Free plan + Starter must expose what we already have (Leads, Tasks, Reminders, Suppliers) — those features get `featureCode = "core_crm"` and are entitled in every plan.

**Acceptance:**
- Create a Free-plan tenant → cannot access `/api/whatsapp/bulk-campaign` (402)
- Create a Business tenant → entitled to everything
- Trial expiry job downgrades to `past_due` and disables writes

---

### Phase 1 — Deals & Pipeline *(3–4 weeks)*

**Why now:** ZNICRM's USP is "execution-focused" — pipeline is the heart of every CRM.

**Backend:**
- `Deal` entity (lead FK, customer FK, stage, value, currency, expected close, owner, custom fields JSON)
- `PipelineStage` per-tenant configurable list (default: Qualified, Proposal, Negotiation, Won, Lost)
- Transitions: `deals/{id}/move` with stage-change audit
- `DealActivity` log

**Frontend:**
- `pages/crm/pipeline/` — kanban board (drag stage), filter by owner/stage
- `pages/crm/deals/` — list + detail (replace current stub)
- Deal-from-Lead conversion flow

**MT:** standard tenant-scoped. Pipeline stages are per-tenant configurable.

**Effort:** ~25 SP

---

### Phase 2 — Companies, Customers, Contacts *(2–3 weeks)*

**Why now:** Deals need a customer record. Currently both are frontend stubs.

**Backend:**
- `Company` entity (name, industry, size, address)
- `Customer` (contact) entity (name, email, phone, company FK, owner)
- Lead-to-customer conversion endpoint
- Dedupe by email/phone

**Frontend:**
- Wire up `pages/crm/companies/` and `pages/crm/customers/` to real APIs
- Inline create-company from customer form

**Effort:** ~15 SP

---

### Phase 3 — Quotes & Invoices *(3–4 weeks)*

**Backend:**
- `Quote` entity (customer FK, deal FK?, line items, discount, tax, total, status: Draft/Sent/Accepted/Rejected/Expired, valid-until)
- `Invoice` entity (customer FK, line items, tax breakdown, total, paid amount, status: Draft/Sent/PartiallyPaid/Paid/Overdue)
- `TaxRule` entity (rate, jurisdiction, applies to product category)
- PDF generation via QuestPDF (already a popular .NET library)
- Email-quote / Email-invoice via existing SMTP
- Convert-quote-to-invoice

**Frontend:**
- `pages/crm/quotes/` + `pages/crm/invoices/`
- PDF preview pane
- Settings → Tax rules CRUD

**MT:** `TaxRule` is tenant-scoped; PDF templates reference tenant brand settings (already in place).

**Effort:** ~30 SP

---

### Phase 4 — Lead Source Integrations *(3–4 weeks)*

**Backend:**
- `LeadSource` entity (channel, credentials, last sync, polling cadence)
- Adapters under `Features/LeadSources/Adapters/`:
  - `FacebookLeadAdsAdapter` — webhook-based
  - `GoogleAdsAdapter` — Conversion API + form submissions
  - `IndiaMartAdapter` — polling REST API
  - `TradeIndiaAdapter` — polling REST API
  - `WatiInboundAdapter` — inbound WhatsApp message → lead (uses existing Wati config)
- Hangfire job per polling adapter
- Webhook endpoint `/api/lead-sources/webhook/{channel}` with HMAC verification

**Frontend:**
- `pages/settings/lead-sources/` — connect/disconnect each channel, OAuth flows, test webhook
- Lead detail shows source + raw payload (debug aid)

**Plan gating:**
- Free/Starter: manual lead creation only
- Grow+: Web + WhatsApp capture
- Business+: all sources

**Effort:** ~35 SP

---

### Phase 5 — Universal Contact Forms + Website Widget *(4–5 weeks)*

This is the **ZNIEngage equivalent** — a standalone embeddable widget that lives outside the main Angular app.

**Backend:**
- `ContactForm` entity (tenant FK, fields JSON schema, redirect URL, captcha config)
- `FormSubmission` entity → auto-creates a `Lead`
- `WidgetSession` (anonymous visitor) tracked by cookie
- Public endpoint `/public/widget/{publicKey}/submit` — no auth, rate-limited

**Frontend (NEW separate bundle):**
- New Angular sub-app at `widget/` — compiles to a single `widget.js` bundle (≤ 60 KB gzipped)
- Web Components: `<znw-form>`, `<znw-popup>`, `<znw-deal-bar>`, `<znw-splash>`, `<znw-exit-intent>`, `<znw-cookie-banner>`
- Configurable via tenant publicKey + features dict from `/public/widget/{publicKey}/config`

**Main app:**
- `pages/settings/forms/` — form builder (drag-drop fields)
- `pages/settings/widget/` — toggle features, copy embed snippet
- `pages/crm/visits/` — anonymous visitor activity log

**Plan gating:** all widget features Grow+; analytics tier-gated by Monthly Unique Hits (10K Starter, 100K Grow, 500K Scale, 1M Business).

**Effort:** ~50 SP

---

### Phase 6 — Campaign Engine (Email + SMS + WhatsApp Bulk) *(4–5 weeks)*

**Backend:**
- `Campaign` entity (channel, audience segment, template, schedule, status)
- `CampaignRecipient` (per-customer send state)
- `Audience` query DSL → JSONLogic-style filter compiled to LINQ
- `MessageTemplate` (channel-specific; WhatsApp uses approved Wati templates)
- Channel adapters: `EmailSender` (existing SMTP), `SmsSender` (new — Twilio/MSG91/Gupshup pluggable), `WhatsAppSender` (existing Wati)
- Hangfire fan-out: 1 campaign → N per-recipient send jobs (rate-limited, retry-on-fail)

**Frontend:**
- `pages/crm/campaigns/` — campaign builder (audience filter UI, template picker, schedule)
- Real-time delivery dashboard (delivered/opened/clicked)

**Plan gating:**
- Grow+: bulk campaigns + custom gateways
- Starter: 1-to-1 sends only

**Effort:** ~45 SP

---

### Phase 7 — Workflow Automation Engine *(4–6 weeks)*

The big-ticket item — a generic rule engine that powers most of ZNICRM's "automation" sells.

**Backend:**
- `WorkflowRule` entity (tenant FK, trigger, conditions, actions, enabled)
- Triggers: `LeadCreated`, `LeadStageChanged`, `DealStageChanged`, `TaskOverdue`, `TimeElapsed(field, duration)`, `IncomingMessage`, etc.
- Conditions: JSONLogic against the entity (supports nested AND/OR)
- Actions: `SendEmail(template)`, `SendWhatsApp(template)`, `CreateTask`, `AssignTo(user|round-robin)`, `MoveStage`, `Webhook(url)`
- Domain event bus (`IDomainEventDispatcher`) — entities raise events; `WorkflowEngine` subscribes and matches against active rules
- Hangfire delayed jobs for time-based triggers

**Frontend:**
- `pages/settings/workflows/` — visual rule builder (trigger | conditions | actions)
- Execution log per rule with replay

**Plan gating:**
- Grow: 10 workflow rules
- Scale: 20 rules
- Business: 30 rules
- Workflow + assignment rules + escalations are progressively unlocked

**Effort:** ~60 SP

---

### Phase 8 — Assignments, Escalations & Approvals *(2–3 weeks)*
*Built on top of the Workflow Engine — these are specialised action types + UI flows.*

**Backend:**
- `AssignmentRule` (lead distribution: round-robin within team, by region, by source, by load)
- `EscalationPolicy` (if X not done in Y hours, escalate to manager)
- `Approval` entity (request type, current step, approval chain, status)
- All three reuse the WorkflowRule infrastructure but with curated UIs

**Frontend:**
- `pages/settings/assignments/`, `pages/settings/escalations/`, `pages/settings/approvals/`
- Approval inbox in the user's dashboard

**Effort:** ~25 SP

---

### Phase 9 — Cloud Telephony, Call Sync & Dialer *(4–6 weeks)*

**Backend:**
- `TelephonyProvider` entity (Twilio / Exotel / Knowlarity / Tata Tele)
- Provider adapters (outbound + recording webhook)
- `CallLog` entity (linked to customer/lead/deal, direction, duration, recording URL)
- Inbound webhook from each provider
- "Click-to-call" endpoint that originates a call via the provider's API
- *Android Call Sync* — separate mobile project; out of scope of this plan but the receiving endpoint `/api/calls/sync` is part of this phase

**Frontend:**
- `pages/settings/telephony/` — provider config
- In-page softphone widget (uses provider's WebRTC SDK if available)
- Call log on every customer/lead/deal record
- Recordings inline-player

**Plan gating:**
- Starter: call sync (Android only)
- Grow: call recording visibility
- Scale+: Dialer + telephony integration

**Effort:** ~50 SP

---

### Phase 10 — Helpdesk & Knowledge Base *(4–5 weeks)*

**Backend:**
- `Ticket` entity (subject, body, status: Open/Pending/Resolved/Closed, priority, customer FK, owner, SLA timer)
- `TicketComment` (public/private replies)
- Email-to-Ticket via IMAP poller (Hangfire job)
- `KnowledgeArticle` entity (title, body, category, status, public slug)
- Public ticket portal at `support.{tenant}.travelcrm.app` (or custom domain)
- Public KB at `help.{tenant}.travelcrm.app`

**Frontend:**
- `pages/crm/tickets/` — agent inbox
- `pages/settings/knowledge-base/` — article CMS
- Public portal sub-app (similar to widget, separate bundle)

**Plan gating:** Scale+ only.

**Effort:** ~50 SP

---

### Phase 11 — Integrations: Webhooks, Zapier, Custom *(2–3 weeks)*

**Backend:**
- `WebhookSubscription` entity (tenant, event types, URL, secret, retry policy)
- Event bus → webhook dispatcher (Hangfire retry queue)
- Zapier integration: list of `triggers` (lead created, deal won, etc.) and `actions` (create lead, send WhatsApp) exposed via REST that Zapier's app definition consumes
- Generic OAuth2 client registration table for "custom integrations"

**Frontend:**
- `pages/settings/webhooks/` — subscriptions list, test fire, recent deliveries

**Plan gating:**
- Grow: 5 webhooks
- Scale: 10 webhooks
- Business: 25 webhooks

**Effort:** ~20 SP

---

### Phase 12 — AI Features *(5–7 weeks)*

Leverage existing `Features/Settings/AiProvider` (Anthropic + others) — the configs are already there.

**Backend:**
- `AiCreditWallet` per tenant (token balance, usage log)
- `Features/AiAgents/`:
  - **Followup Intelligence** — nightly job scores every active lead/deal; surfaces top-N to each owner
  - **Deal Revival** — finds stale deals (no activity in 30d) and proposes a tailored revival message
  - **Lead Qualifier Bot** — when a new lead comes in, runs through a configurable Q&A flow (WhatsApp or chat) before assignment
  - **AI Reply Suggestions** — agent sees suggested email/WhatsApp replies in real-time
- All routes through the `IAiProviderClient` abstraction — provider-agnostic
- Token metering middleware on AI requests → debit `AiCreditWallet`

**Frontend:**
- `pages/crm/ai-insights/` — Followup Intelligence + Deal Revival dashboards
- Inline AI suggestions in lead/deal/customer detail
- `pages/settings/ai/` already exists — extend with wallet balance + usage chart

**Plan gating:**
- Scale: Followup Intelligence + Deal Revival
- Business: + AI chatbots + reply suggestions
- AI credits sold separately (₹1 = 1 AIC per ZNICRM model)

**Effort:** ~70 SP

---

### Phase 13 — Reports & Analytics *(3–4 weeks)*

**Backend:**
- `ReportDefinition` entity (tenant FK, type, filter JSON, columns, schedule)
- Standard reports: Conversion funnel, Source ROI, Sales velocity, Team performance, Pipeline forecast, Activity report
- CSV/Excel export via EPPlus
- Scheduled email delivery (re-uses Campaign engine)

**Frontend:**
- `pages/crm/reports/` — wire up the stub
- ApexCharts-based dashboards
- Report builder (column picker, filter UI)
- Manager-only "team performance" views (permission-gated)

**Plan gating:** Scale+ for custom reports; standard reports in Starter+.

**Effort:** ~30 SP

---

### Phase 14 — Polish: Custom Domains, Document Storage Quotas, Billing UX *(2–3 weeks)*

**Backend:**
- `TenantDomain` mapping + Let's Encrypt automation
- Per-tenant storage byte counter (incremented in `FileStorage.SaveAsync`, decremented on delete)
- Stripe / Razorpay subscription adapter — feed back into `TenantSubscription.Status`
- Self-serve billing portal endpoints

**Frontend:**
- `pages/settings/billing/` — invoices history, payment method, plan upgrade flow with Stripe Checkout
- Storage usage meter visible in dashboard

**Effort:** ~25 SP

---

## 7. Cross-Cutting Concerns

### 7.1 Feature Flags vs Plan Gates vs Tenant Settings

Three distinct concepts — keep them separate:

| Concept | What | Stored Where | Example |
|---|---|---|---|
| **Plan Feature** | Sold per tier | `Plan.featureCodes` | `whatsapp_bulk_campaign` |
| **Tenant Setting** | Configured per tenant | `tenant_settings` | SMTP host, default currency |
| **Feature Flag** | Engineering toggle (canary, kill-switch) | Config file / Unleash | `new_pipeline_kanban_v2` |

A user-visible button is shown only if **all three** conditions are met: plan entitles it, tenant has configured it, feature flag is on.

### 7.2 Plan-Limit Enforcement Pattern

```csharp
// In a Create handler — pseudo-code
public async Task<Result> Handle(CreateWebhookCommand cmd, …)
{
    var count = await _db.Webhooks.CountAsync(w => w.TenantId == _tenant.Id);
    var limit = await _entitlements.GetLimitAsync(_tenant.Id, "webhook_count");
    if (count >= limit)
        return Result.Fail("plan_limit_reached:webhook_count");
    // … proceed to create
}
```

The Angular service catches `plan_limit_reached:*` errors and shows the upgrade modal.

### 7.3 Data Migration Discipline

Every phase adds entities. Mandatory:
- One EF migration per phase, named `YYYYMMDD_phaseN_*`
- Backfill scripts for existing tenants where a new column needs a default
- Smoke test on a staging tenant before production migration

### 7.4 Security Per Feature

- **Lead source webhooks** must verify HMAC signatures per provider
- **Public widget endpoints** must rate-limit per IP and per tenant publicKey
- **Payment gateway webhooks** must verify signed payloads (Stripe/Razorpay HMAC)
- **Custom domains** require ownership verification (DNS TXT record check before activation)
- Every new permission added to `PermissionCatalog` with a clear description; `RolePermissionSeeder` keeps Admin-default grants up to date

### 7.5 Observability

- Each new feature adds Serilog scope `Feature=<code>` so we can filter by feature in Seq
- Hangfire dashboard exposes per-feature job queues
- New `metrics` endpoint for Prometheus (per-tenant active users, campaign send rate, AI tokens consumed)

---

## 8. Effort Summary

| Phase | Duration | Story Points | Sellable Plan Increment |
|---|---|---|---|
| 0 — Subscriptions & Feature Gating | 2–3 wk | 15 | (foundation) |
| 1 — Deals & Pipeline | 3–4 wk | 25 | Starter MVP |
| 2 — Companies & Customers | 2–3 wk | 15 | Starter complete |
| 3 — Quotes & Invoices | 3–4 wk | 30 | Grow blocks unlock |
| 4 — Lead Source Integrations | 3–4 wk | 35 | Starter parity with ZNICRM |
| 5 — Universal Contact Forms + Widget | 4–5 wk | 50 | Grow parity |
| 6 — Campaign Engine | 4–5 wk | 45 | Grow complete |
| 7 — Workflow Automation | 4–6 wk | 60 | Grow / Scale unlock |
| 8 — Assignments, Escalations, Approvals | 2–3 wk | 25 | Business unlock |
| 9 — Cloud Telephony & Dialer | 4–6 wk | 50 | Scale parity |
| 10 — Helpdesk & Knowledge Base | 4–5 wk | 50 | Scale parity |
| 11 — Integrations (Webhooks, Zapier) | 2–3 wk | 20 | Cross-tier |
| 12 — AI Features | 5–7 wk | 70 | Scale / Business |
| 13 — Reports & Analytics | 3–4 wk | 30 | All tiers |
| 14 — Custom Domains & Billing UX | 2–3 wk | 25 | Business complete |
| **Total** | **47–67 wk** | **545 SP** | Full ZNICRM parity |

With **3 engineers in parallel** (no dependency conflicts), realistic ship is **12–14 months**; with **5 engineers**, **9–11 months**.

---

## 9. Critical Dependencies & Sequencing Notes

1. **Phase 0 must ship first.** Every later phase reads `IFeatureGate`.
2. **Phases 1 → 2 → 3** must stay in this order — invoices need customers, customers need deals.
3. **Phase 7 (Workflow Engine)** unblocks Phase 8 and is heavily used by Phases 4, 6, 9, 10, 12.
4. **Phases 5 (widget), 10 (support portal), 14 (custom domain)** all need the same wildcard-cert automation — landing 14 first lets 5 and 10 reuse it.
5. **Phase 12 (AI)** is parallelisable with everything from Phase 3 onwards.
6. **Phases 4, 9 are integration-heavy** — partner accounts (IndiaMART, FB, Twilio) must be procured before sprint start.

---

## 10. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WhatsApp template approval delays (Wati / Meta) | High | Medium | Submit templates 2 weeks before launch; have generic fall-back templates pre-approved |
| Telephony provider regional restrictions | Medium | Medium | Build adapter abstraction so we can swap providers per-region |
| AI cost runaway from misbehaving agents | Medium | High | Hard per-tenant token cap + circuit breaker; per-feature cost cap |
| Custom domain SSL automation (Let's Encrypt rate limits) | Medium | Medium | Use ACME staging in dev; pre-warm certs at provisioning time |
| Plan migration of existing tenants | High | Low | Default all existing tenants to "Unlimited" trial for 90 days; collect feedback before forcing into paid tiers |
| Performance regression from new global filters / FeatureGate checks | Medium | High | Cache entitlements per-request; benchmark in CI |
| Workflow rule infinite loops (rule A triggers rule B triggers rule A) | Medium | High | Per-event execution depth limit; circular-dependency static check at rule save |

---

## 11. Definition of Done (per phase)

A phase is "Done" only when **all of**:

- [ ] All entities have EF migrations + seed data
- [ ] All endpoints have FluentValidation + permission attributes + integration tests
- [ ] All UI screens are responsive (mobile + dark mode using existing token system)
- [ ] Feature is gated by `IFeatureGate` at the API layer
- [ ] Plan-limit counters increment correctly + a "limit reached" upgrade flow exists in the UI
- [ ] Permission catalog updated; `RolePermissionSeeder` grants Admin by default
- [ ] Hangfire jobs (if any) have a dashboard tag and dead-letter queue
- [ ] `docs/implemented-modules.docx` regenerated to reflect new modules
- [ ] Graphify (`graphify update .`) run to keep the knowledge graph current
- [ ] One demo tenant provisioned + smoke-tested by QA

---

## 12. Open Questions for Stakeholders

1. **Target market** — Indian travel agencies (₹ pricing, IndiaMART/TradeIndia priority) or global (USD, FB/Google priority)?
2. **Field Force (TeamSpoor)** — bundle it as a Business-tier feature inside TravelCRMPlus, or keep it as a sister product?
3. **Travel-specific inventory** (Hotels/Transport/Activity already built) — extend ZNICRM's generic Products module to merge, or keep them separate?
4. **AI provider primary** — Anthropic only (already configured) or multi-provider routing (OpenAI/Google/local)?
5. **Mobile app** — native iOS+Android, Capacitor wrapper of Angular app, or web-only?
6. **Payment gateways** — Razorpay (India) + Stripe (global) — both from day one of Phase 14?
7. **Domain mapping** — self-serve in UI, or support-team-assisted for the first 6 months?

---

*This plan is a living document. After Phase 0 ships, it should be refined with actual velocity numbers and re-prioritised against customer feedback from the first cohort of paying tenants.*
