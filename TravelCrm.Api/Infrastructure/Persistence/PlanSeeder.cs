using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Subscriptions;

namespace TravelCrm.Api.Infrastructure.Persistence;

/// <summary>
/// Seeds the 6 plan tiers (Free / Starter / Grow / Scale / Business / Unlimited)
/// and ensures every existing tenant has a <see cref="TenantSubscription"/> row.
///
/// <para>Idempotent — re-runnable on every boot. Adds missing plans, adds
/// missing features to existing plans, but never overwrites pricing or limits
/// that an admin might have edited via the Platform Plans UI.</para>
/// </summary>
public static class PlanSeeder
{
    /// <summary>Stable IDs so re-seeds and tests get deterministic FKs.</summary>
    private static readonly Guid FreeId       = Guid.Parse("00000000-0000-0000-0000-000000000a01");
    private static readonly Guid StarterId    = Guid.Parse("00000000-0000-0000-0000-000000000a02");
    private static readonly Guid GrowId       = Guid.Parse("00000000-0000-0000-0000-000000000a03");
    private static readonly Guid ScaleId      = Guid.Parse("00000000-0000-0000-0000-000000000a04");
    private static readonly Guid BusinessId   = Guid.Parse("00000000-0000-0000-0000-000000000a05");
    private static readonly Guid UnlimitedId  = Guid.Parse("00000000-0000-0000-0000-000000000a06");

    public static async Task SeedAsync(ApplicationDbContext db, CancellationToken ct = default)
    {
        // ── 1. Plans + features ──────────────────────────────────────────────

        foreach (var def in PlanDefinitions)
        {
            var existing = await db.Plans
                .Include(p => p.Features)
                .FirstOrDefaultAsync(p => p.Id == def.Id, ct);

            if (existing is null)
            {
                // Brand-new plan — insert with full feature list
                var plan = new Plan
                {
                    Id                  = def.Id,
                    Code                = def.Code,
                    Name                = def.Name,
                    Description         = def.Description,
                    MonthlyPrice        = def.MonthlyPrice,
                    AnnualPricePerMonth = def.AnnualPricePerMonth,
                    FlatMonthlyPrice    = def.FlatMonthlyPrice,
                    Currency            = def.Currency,
                    SeatLimit           = def.SeatLimit,
                    StorageGbLimit      = def.StorageGbLimit,
                    WebhookLimit        = def.WebhookLimit,
                    WorkflowRuleLimit   = def.WorkflowRuleLimit,
                    MarketingRuleLimit  = def.MarketingRuleLimit,
                    ChatLicenseLimit    = def.ChatLicenseLimit,
                    DepartmentLimit     = def.DepartmentLimit,
                    RoleLimit           = def.RoleLimit,
                    IsActive            = true,
                    IsContactSalesOnly  = def.IsContactSalesOnly,
                    SortOrder           = def.SortOrder,
                    CreatedAt           = DateTime.UtcNow,
                    Features            = def.FeatureCodes
                        .Select(fc => new PlanFeature { PlanId = def.Id, FeatureCode = fc })
                        .ToList(),
                };
                db.Plans.Add(plan);
            }
            else
            {
                // Plan exists — only add any feature codes that have been newly
                // declared since the last boot. Don't remove codes that an admin
                // may have manually attached, and don't overwrite pricing.
                var have = existing.Features.Select(f => f.FeatureCode).ToHashSet(StringComparer.Ordinal);
                foreach (var code in def.FeatureCodes.Where(c => !have.Contains(c)))
                {
                    db.PlanFeatures.Add(new PlanFeature { PlanId = existing.Id, FeatureCode = code });
                }
            }
        }
        await db.SaveChangesAsync(ct);

        // ── 2. Backfill subscriptions for tenants that don't have one yet ────
        // Maps the legacy Tenant.Plan free-text column to a known plan code,
        // falling back to Starter if the string doesn't match any known tier.

        var tenants = await db.Tenants.ToListAsync(ct);
        foreach (var tenant in tenants)
        {
            var hasSub = await db.TenantSubscriptions.AnyAsync(s => s.TenantId == tenant.Id, ct);
            if (hasSub) continue;

            var (planId, planCode) = MapLegacyPlanString(tenant.Plan);
            db.TenantSubscriptions.Add(new TenantSubscription
            {
                TenantId            = tenant.Id,
                PlanId              = planId,
                PlanCode            = planCode,
                Status              = planCode == "free" ? SubscriptionStatus.Free : SubscriptionStatus.Active,
                CurrentPeriodStart  = DateTime.UtcNow,
                CurrentPeriodEnd    = DateTime.UtcNow.AddYears(1),  // grandfather existing tenants for a year
                ActivatedAt         = DateTime.UtcNow,
                CreatedAt           = DateTime.UtcNow,
            });
        }
        await db.SaveChangesAsync(ct);
    }

    private static (Guid PlanId, string Code) MapLegacyPlanString(string legacy)
    {
        // Legacy values seen in the wild: "Starter", "Professional", "Enterprise"
        return legacy?.Trim().ToLowerInvariant() switch
        {
            "free"         => (FreeId,      "free"),
            "starter"      => (StarterId,   "starter"),
            "grow"         => (GrowId,      "grow"),
            "professional" => (GrowId,      "grow"),         // old name
            "scale"        => (ScaleId,     "scale"),
            "business"     => (BusinessId,  "business"),
            "enterprise"   => (UnlimitedId, "unlimited"),    // old name
            "unlimited"    => (UnlimitedId, "unlimited"),
            _              => (StarterId,   "starter"),       // safe default
        };
    }

    // ── Plan definitions ─────────────────────────────────────────────────────

    private sealed record PlanDef(
        Guid Id,
        string Code,
        string Name,
        string Description,
        decimal? MonthlyPrice,
        decimal? AnnualPricePerMonth,
        decimal? FlatMonthlyPrice,
        string Currency,
        int? SeatLimit,
        int? StorageGbLimit,
        int? WebhookLimit,
        int? WorkflowRuleLimit,
        int? MarketingRuleLimit,
        int? ChatLicenseLimit,
        int? DepartmentLimit,
        int? RoleLimit,
        bool IsContactSalesOnly,
        int SortOrder,
        string[] FeatureCodes);

    /// <summary>
    /// The 6 seed plans. Pricing mirrors ZNICRM, limits adapted to TravelCRM.
    /// Feature codes use <see cref="FeatureCatalog"/> constants — never hardcode strings.
    /// </summary>
    private static readonly PlanDef[] PlanDefinitions =
    {
        // ── Free / Explore ──────────────────────────────────────────────────
        new PlanDef(
            Id: FreeId, Code: "free", Name: "Explore",
            Description: "Try TravelCRMPlus with up to 3 users. Self-serve setup.",
            MonthlyPrice: 0, AnnualPricePerMonth: 0, FlatMonthlyPrice: null, Currency: "INR",
            SeatLimit: 3, StorageGbLimit: 1, WebhookLimit: 0, WorkflowRuleLimit: 0,
            MarketingRuleLimit: 0, ChatLicenseLimit: 1, DepartmentLimit: 1, RoleLimit: 2,
            IsContactSalesOnly: false, SortOrder: 10,
            FeatureCodes: new[]
            {
                FeatureCatalog.CoreCrm, FeatureCatalog.CoreTasks, FeatureCatalog.CoreInventory,
                FeatureCatalog.CoreSettings,
                FeatureCatalog.PipelineKanban,
            }),

        // ── Starter ─────────────────────────────────────────────────────────
        new PlanDef(
            Id: StarterId, Code: "starter", Name: "Starter",
            Description: "Small teams that want structure without complexity.",
            MonthlyPrice: 349, AnnualPricePerMonth: 249, FlatMonthlyPrice: null, Currency: "INR",
            SeatLimit: null, StorageGbLimit: 1, WebhookLimit: 0, WorkflowRuleLimit: 0,
            MarketingRuleLimit: 0, ChatLicenseLimit: 3, DepartmentLimit: 2, RoleLimit: 2,
            IsContactSalesOnly: false, SortOrder: 20,
            FeatureCodes: new[]
            {
                FeatureCatalog.CoreCrm, FeatureCatalog.CoreTasks, FeatureCatalog.CoreInventory,
                FeatureCatalog.CoreSettings,
                FeatureCatalog.Deals, FeatureCatalog.Proposals, FeatureCatalog.PipelineKanban,
                FeatureCatalog.LeadDistribution,
                FeatureCatalog.LeadSourceFacebook, FeatureCatalog.LeadSourceGoogleAds,
                FeatureCatalog.LeadSourceIndiaMart, FeatureCatalog.LeadSourceTradeIndia,
                FeatureCatalog.CallSync,
                FeatureCatalog.StandardReports,
            }),

        // ── Grow ────────────────────────────────────────────────────────────
        new PlanDef(
            Id: GrowId, Code: "grow", Name: "Grow",
            Description: "Sales teams ready to improve follow-up speed and conversion.",
            MonthlyPrice: 699, AnnualPricePerMonth: 499, FlatMonthlyPrice: null, Currency: "INR",
            SeatLimit: null, StorageGbLimit: 5, WebhookLimit: 5, WorkflowRuleLimit: 10,
            MarketingRuleLimit: 5, ChatLicenseLimit: 10, DepartmentLimit: 5, RoleLimit: 3,
            IsContactSalesOnly: false, SortOrder: 30,
            FeatureCodes: new[]
            {
                FeatureCatalog.CoreCrm, FeatureCatalog.CoreTasks, FeatureCatalog.CoreInventory,
                FeatureCatalog.CoreSettings,
                FeatureCatalog.Deals, FeatureCatalog.Proposals, FeatureCatalog.PipelineKanban,
                FeatureCatalog.Checklists,
                FeatureCatalog.LeadDistribution,
                FeatureCatalog.LeadSourceFacebook, FeatureCatalog.LeadSourceGoogleAds,
                FeatureCatalog.LeadSourceIndiaMart, FeatureCatalog.LeadSourceTradeIndia,
                FeatureCatalog.LeadSourceWhatsApp, FeatureCatalog.LeadSourceWebForms,
                FeatureCatalog.EmailCampaign, FeatureCatalog.SmsCampaign,
                FeatureCatalog.WhatsAppOneToOne, FeatureCatalog.WhatsAppBulkCampaign,
                FeatureCatalog.CustomGateways,
                FeatureCatalog.CallSync, FeatureCatalog.CallRecording,
                FeatureCatalog.WorkflowAutomation, FeatureCatalog.MarketingAutomation,
                FeatureCatalog.Quotes, FeatureCatalog.Invoices,
                FeatureCatalog.ProductCatalog,
                FeatureCatalog.WebsiteWidget, FeatureCatalog.WidgetPopupForm,
                FeatureCatalog.WidgetSplash, FeatureCatalog.WidgetExitIntent,
                FeatureCatalog.WidgetDealBar, FeatureCatalog.WidgetCookieBanner,
                FeatureCatalog.Webhooks,
                FeatureCatalog.StandardReports,
            }),

        // ── Scale ───────────────────────────────────────────────────────────
        new PlanDef(
            Id: ScaleId, Code: "scale", Name: "Scale",
            Description: "Teams that need stronger control, service workflows, and automation.",
            MonthlyPrice: 999, AnnualPricePerMonth: 750, FlatMonthlyPrice: null, Currency: "INR",
            SeatLimit: null, StorageGbLimit: 10, WebhookLimit: 10, WorkflowRuleLimit: 20,
            MarketingRuleLimit: 10, ChatLicenseLimit: 25, DepartmentLimit: 10, RoleLimit: 5,
            IsContactSalesOnly: false, SortOrder: 40,
            FeatureCodes: new[]
            {
                FeatureCatalog.CoreCrm, FeatureCatalog.CoreTasks, FeatureCatalog.CoreInventory,
                FeatureCatalog.CoreSettings,
                FeatureCatalog.Deals, FeatureCatalog.Proposals, FeatureCatalog.PipelineKanban,
                FeatureCatalog.Checklists,
                FeatureCatalog.FollowupIntelligence, FeatureCatalog.DealRevival,
                FeatureCatalog.LeadDistribution,
                FeatureCatalog.LeadSourceFacebook, FeatureCatalog.LeadSourceGoogleAds,
                FeatureCatalog.LeadSourceIndiaMart, FeatureCatalog.LeadSourceTradeIndia,
                FeatureCatalog.LeadSourceWhatsApp, FeatureCatalog.LeadSourceWebForms,
                FeatureCatalog.EmailCampaign, FeatureCatalog.SmsCampaign,
                FeatureCatalog.WhatsAppOneToOne, FeatureCatalog.WhatsAppBulkCampaign,
                FeatureCatalog.ChatBots, FeatureCatalog.CustomGateways,
                FeatureCatalog.CallSync, FeatureCatalog.CallRecording,
                FeatureCatalog.CloudTelephony, FeatureCatalog.Dialer,
                FeatureCatalog.WorkflowAutomation, FeatureCatalog.MarketingAutomation,
                FeatureCatalog.Quotes, FeatureCatalog.Invoices, FeatureCatalog.MultipleTaxes,
                FeatureCatalog.AutoTaxApplication, FeatureCatalog.Receipts,
                FeatureCatalog.PaymentGateway, FeatureCatalog.Subscriptions,
                FeatureCatalog.ProductCatalog, FeatureCatalog.StockManagement,
                FeatureCatalog.PurchaseOrders,
                FeatureCatalog.Helpdesk, FeatureCatalog.SupportPortal,
                FeatureCatalog.EmailToTicket, FeatureCatalog.KnowledgeBase,
                FeatureCatalog.WebsiteWidget, FeatureCatalog.WidgetPopupForm,
                FeatureCatalog.WidgetSplash, FeatureCatalog.WidgetExitIntent,
                FeatureCatalog.WidgetDealBar, FeatureCatalog.WidgetCookieBanner,
                FeatureCatalog.Webhooks, FeatureCatalog.ZapierIntegration,
                FeatureCatalog.AiCredits, FeatureCatalog.AiWebsiteChatbot,
                FeatureCatalog.StandardReports, FeatureCatalog.CustomReports,
            }),

        // ── Business Suite ──────────────────────────────────────────────────
        new PlanDef(
            Id: BusinessId, Code: "business", Name: "Business Suite",
            Description: "Larger teams that need tighter control across departments.",
            MonthlyPrice: 1499, AnnualPricePerMonth: 1250, FlatMonthlyPrice: null, Currency: "INR",
            SeatLimit: 50, StorageGbLimit: 25, WebhookLimit: 25, WorkflowRuleLimit: 30,
            MarketingRuleLimit: 25, ChatLicenseLimit: 50, DepartmentLimit: 15, RoleLimit: 10,
            IsContactSalesOnly: false, SortOrder: 50,
            FeatureCodes: FeatureCatalog.All.ToArray()),  // Business gets everything

        // ── Unlimited (contact sales) ───────────────────────────────────────
        new PlanDef(
            Id: UnlimitedId, Code: "unlimited", Name: "Unlimited",
            Description: "Fixed-rate plan without per-user pricing. Includes all Business features plus dedicated support.",
            MonthlyPrice: null, AnnualPricePerMonth: null, FlatMonthlyPrice: 14999, Currency: "INR",
            SeatLimit: null, StorageGbLimit: null, WebhookLimit: null, WorkflowRuleLimit: null,
            MarketingRuleLimit: null, ChatLicenseLimit: null, DepartmentLimit: null, RoleLimit: null,
            IsContactSalesOnly: true, SortOrder: 60,
            FeatureCodes: FeatureCatalog.All.ToArray()),
    };
}
