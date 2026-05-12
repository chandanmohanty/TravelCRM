namespace TravelCrm.Api.Common;

/// <summary>
/// Single source of truth for every feature code in the system. New plan-gated
/// features <b>must</b> register their code here before referencing it in
/// <c>[RequiresFeature]</c>, the FeatureGate service, or the plan seeder.
///
/// <para>Why a static class instead of an enum: codes are persisted in
/// <c>plan_features.feature_code</c> as strings, so refactor-safety wins out
/// over enum compactness — renaming a constant flows through every call site
/// at compile time, but the persisted code stays stable until you write a
/// migration to rename it.</para>
///
/// <para>Codes follow the convention <c>area_thing</c> in snake_case. Keep them
/// short (≤ 40 chars) so they fit comfortably in the JSON entitlements
/// payload sent to the Angular client.</para>
/// </summary>
public static class FeatureCatalog
{
    // ── Core (always entitled — present even on the Free tier) ────────────────
    // These mirror the modules already implemented in TravelCRMPlus today; we
    // assign them to every plan so the existing app keeps working unchanged
    // after Phase 0 ships.

    public const string CoreCrm           = "core_crm";            // Leads, Customers, Companies (read/write)
    public const string CoreTasks         = "core_tasks";          // Tasks, Time Entries, Reminders
    public const string CoreInventory     = "core_inventory";      // Suppliers, Resources, Calendar, Holds
    public const string CoreSettings      = "core_settings";       // Brand, locale, system settings

    // ── Lead Capture ─────────────────────────────────────────────────────────

    public const string LeadDistribution    = "lead_distribution";    // Auto-assign rules
    public const string LeadSourceFacebook  = "lead_source_facebook"; // FB Lead Ads
    public const string LeadSourceGoogleAds = "lead_source_google_ads";
    public const string LeadSourceIndiaMart = "lead_source_indiamart";
    public const string LeadSourceTradeIndia= "lead_source_tradeindia";
    public const string LeadSourceWhatsApp  = "lead_source_whatsapp";
    public const string LeadSourceWebForms  = "lead_source_web_forms";

    // ── Communication ────────────────────────────────────────────────────────

    public const string EmailCampaign        = "email_campaign";
    public const string SmsCampaign          = "sms_campaign";
    public const string WhatsAppOneToOne     = "whatsapp_1to1";
    public const string WhatsAppBulkCampaign = "whatsapp_bulk_campaign";
    public const string ChatBots             = "chat_bots";
    public const string CustomGateways       = "custom_gateways";       // BYO SMTP / SMS provider
    public const string CallSync             = "call_sync";             // Android device call log
    public const string CallRecording        = "call_recording";        // Auto-upload from device
    public const string CloudTelephony       = "cloud_telephony";       // Twilio / Exotel / etc.
    public const string Dialer               = "dialer";                // Click-to-call / auto-dialer

    // ── Sales Pipeline ───────────────────────────────────────────────────────

    public const string Deals               = "deals";
    public const string Proposals           = "proposals";       // Quotation builder
    public const string PipelineKanban      = "pipeline_kanban";
    public const string Checklists          = "checklists";      // Per-stage required steps
    public const string FollowupIntelligence= "followup_intelligence";  // AI lead scoring
    public const string DealRevival         = "deal_revival";           // AI stale-deal nudge

    // ── Workflow & Automation ────────────────────────────────────────────────

    public const string WorkflowAutomation  = "workflow_automation";    // Generic rule engine
    public const string MarketingAutomation = "marketing_automation";   // Drip / sequence
    public const string Assignments         = "assignments";            // Rule-based ownership
    public const string Escalations         = "escalations";            // SLA timers
    public const string Approvals           = "approvals";              // Multi-step approval chains

    // ── Invoicing & Billing ──────────────────────────────────────────────────

    public const string Quotes              = "quotes";
    public const string Invoices            = "invoices";
    public const string MultipleTaxes       = "multiple_taxes";
    public const string AutoTaxApplication  = "auto_tax_application";   // Geo-based
    public const string Receipts            = "receipts";
    public const string PaymentGateway      = "payment_gateway";        // Razorpay / Stripe
    public const string Subscriptions       = "subscriptions";          // Recurring billing for customers

    // ── Inventory & Products ─────────────────────────────────────────────────

    public const string ProductCatalog      = "product_catalog";        // Generic SKU products
    public const string StockManagement     = "stock_management";       // Quantity tracking
    public const string PurchaseOrders      = "purchase_orders";

    // ── Helpdesk & Knowledge ─────────────────────────────────────────────────

    public const string Helpdesk            = "helpdesk";               // Internal ticket inbox
    public const string SupportPortal       = "support_portal";         // Customer-facing portal
    public const string EmailToTicket       = "email_to_ticket";
    public const string KnowledgeBase       = "knowledge_base";

    // ── Integrations ─────────────────────────────────────────────────────────

    public const string Webhooks            = "webhooks";               // Outbound webhooks
    public const string ZapierIntegration   = "zapier_integration";
    public const string Shopify             = "shopify";
    public const string CustomIntegration   = "custom_integration";     // Paid bespoke wiring

    // ── ZNIEngage Widget ─────────────────────────────────────────────────────

    public const string WebsiteWidget       = "website_widget";         // Master toggle
    public const string WidgetPopupForm     = "widget_popup_form";
    public const string WidgetSplash        = "widget_splash";
    public const string WidgetExitIntent    = "widget_exit_intent";
    public const string WidgetDealBar       = "widget_deal_bar";
    public const string WidgetCookieBanner  = "widget_cookie_banner";

    // ── AI ───────────────────────────────────────────────────────────────────

    public const string AiCredits           = "ai_credits";             // Wallet-based AI metering
    public const string AiWebsiteChatbot    = "ai_website_chatbot";
    public const string AiWhatsAppChatbot   = "ai_whatsapp_chatbot";
    public const string AiReplySuggestions  = "ai_reply_suggestions";

    // ── Reporting ────────────────────────────────────────────────────────────

    public const string StandardReports     = "standard_reports";
    public const string CustomReports       = "custom_reports";
    public const string ManagerDashboards   = "manager_dashboards";

    // ── Enterprise ───────────────────────────────────────────────────────────

    public const string CustomDomain        = "custom_domain";          // crm.acme.com
    public const string PrioritySupport     = "priority_support";
    public const string FieldTeamVisibility = "field_team_visibility";  // TeamSpoor bridge

    /// <summary>
    /// All declared feature codes — used by the seeder + validation to reject
    /// unknown codes at boot time. Keep this in sync with the constants above.
    /// </summary>
    public static readonly IReadOnlyList<string> All = new[]
    {
        // Core
        CoreCrm, CoreTasks, CoreInventory, CoreSettings,
        // Lead capture
        LeadDistribution, LeadSourceFacebook, LeadSourceGoogleAds,
        LeadSourceIndiaMart, LeadSourceTradeIndia, LeadSourceWhatsApp, LeadSourceWebForms,
        // Communication
        EmailCampaign, SmsCampaign, WhatsAppOneToOne, WhatsAppBulkCampaign,
        ChatBots, CustomGateways, CallSync, CallRecording, CloudTelephony, Dialer,
        // Pipeline
        Deals, Proposals, PipelineKanban, Checklists, FollowupIntelligence, DealRevival,
        // Workflow
        WorkflowAutomation, MarketingAutomation, Assignments, Escalations, Approvals,
        // Invoicing
        Quotes, Invoices, MultipleTaxes, AutoTaxApplication, Receipts,
        PaymentGateway, Subscriptions,
        // Inventory
        ProductCatalog, StockManagement, PurchaseOrders,
        // Helpdesk
        Helpdesk, SupportPortal, EmailToTicket, KnowledgeBase,
        // Integrations
        Webhooks, ZapierIntegration, Shopify, CustomIntegration,
        // Widget
        WebsiteWidget, WidgetPopupForm, WidgetSplash, WidgetExitIntent,
        WidgetDealBar, WidgetCookieBanner,
        // AI
        AiCredits, AiWebsiteChatbot, AiWhatsAppChatbot, AiReplySuggestions,
        // Reporting
        StandardReports, CustomReports, ManagerDashboards,
        // Enterprise
        CustomDomain, PrioritySupport, FieldTeamVisibility,
    };

    /// <summary>True if <paramref name="code"/> is a known feature code.</summary>
    public static bool IsKnown(string code) =>
        All.Contains(code, StringComparer.Ordinal);
}
