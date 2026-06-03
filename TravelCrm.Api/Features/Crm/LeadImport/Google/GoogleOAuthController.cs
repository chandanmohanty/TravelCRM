using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Infrastructure.Google;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.Subscriptions;

namespace TravelCrm.Api.Features.Crm.LeadImport.Google;

/// <summary>
/// OAuth flow for the platform Google Sheets integration: status / auth-url
/// / browser callback / disconnect. State is HMAC-signed and tenant-bound
/// (see <see cref="OAuthState"/>). The HMAC key is derived from the data-
/// protection key ring so it survives restarts and rolls with the key ring.
/// </summary>
[Authorize]
[ApiController]
[RequiresFeature(FeatureCatalog.LeadImport)]
[Route("api/crm/leads/import/google")]
public sealed class GoogleOAuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ICurrentUser _user;
    private readonly IGoogleSheetsGate _gate;
    private readonly IGoogleTokenProvider _tokenProvider;
    private readonly ILogger<GoogleOAuthController> _logger;
    private readonly byte[] _stateKey;

    public GoogleOAuthController(
        ApplicationDbContext db,
        ITenantContext tenant,
        ICurrentUser user,
        IGoogleSheetsGate gate,
        IGoogleTokenProvider tokenProvider,
        IDataProtectionProvider dataProtection,
        ILogger<GoogleOAuthController> logger)
    {
        _db = db;
        _tenant = tenant;
        _user = user;
        _gate = gate;
        _tokenProvider = tokenProvider;
        _logger = logger;

        var protector = dataProtection.CreateProtector("lead-import.oauth-state.v1");
        var protectedBytes = protector.Protect(Encoding.UTF8.GetBytes("lead-import-state-key"));
        _stateKey = SHA256.HashData(protectedBytes);
    }

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        if (!_user.HasPermission("crm.leads.view"))
            return Forbid();
        if (!_tenant.IsResolved)
            return BadRequest(new { error = "Tenant not resolved" });

        var tenantId = _tenant.TenantId!.Value;
        var token = await _db.GoogleOAuthTokens.AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId, ct);

        return Ok(new GoogleStatusDto(_gate.IsConfigured, token != null, token?.GrantedScopes ?? ""));
    }

    [HttpGet("auth-url")]
    public IActionResult AuthUrl()
    {
        if (!_user.HasPermission("crm.leads.manage"))
            return Forbid();
        if (!_tenant.IsResolved)
            return BadRequest(new { error = "Tenant not resolved" });
        if (!_gate.IsConfigured)
            return Conflict(new { error = "Google Sheets integration is not configured on this server." });

        var state = OAuthState.Create(_tenant.TenantId!.Value, _stateKey, DateTimeOffset.UtcNow.AddMinutes(10));
        return Ok(new { url = _tokenProvider.BuildAuthUrl(state) });
    }

    [HttpGet("callback")]
    public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
            return HtmlError(400, "Missing parameters");

        if (!OAuthState.TryValidate(state, _stateKey, DateTimeOffset.UtcNow, out var tenantId))
            return HtmlError(400, "Invalid or expired state");

        if (!_tenant.IsResolved || _tenant.TenantId!.Value != tenantId)
            return HtmlError(403, "Tenant mismatch");

        if (!_user.HasPermission("crm.leads.manage"))
            return HtmlError(403, "Forbidden");

        var (refreshToken, scopes) = await _tokenProvider.ExchangeCodeAsync(code, ct);

        var existing = await _db.GoogleOAuthTokens.FirstOrDefaultAsync(t => t.TenantId == tenantId, ct);
        if (existing is null)
        {
            _db.GoogleOAuthTokens.Add(new GoogleOAuthToken
            {
                TenantId = tenantId,
                RefreshToken = refreshToken,
                GrantedScopes = scopes,
                ConnectedByUserId = _user.IsAuthenticated ? _user.UserId : Guid.Empty,
                ConnectedAt = DateTime.UtcNow,
            });
        }
        else
        {
            existing.RefreshToken = refreshToken;
            existing.GrantedScopes = scopes;
            existing.ConnectedByUserId = _user.IsAuthenticated ? _user.UserId : Guid.Empty;
            existing.ConnectedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync(ct);

        var sources = await _db.LeadImportSources
            .Where(s => s.TenantId == tenantId && s.Status == LeadImportSourceStatus.Disconnected)
            .ToListAsync(ct);
        foreach (var s in sources) s.Status = LeadImportSourceStatus.Active;
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Google OAuth connected for tenant {TenantId}", tenantId);

        return Content(
            "<!doctype html><meta charset=utf-8><script>" +
            "try{window.opener&&window.opener.postMessage('google-connected','*');}catch(e){}" +
            "window.close();" +
            "document.body.innerText='You can close this window.';" +
            "</script>",
            "text/html");
    }

    [HttpPost("disconnect")]
    public async Task<IActionResult> Disconnect(CancellationToken ct)
    {
        if (!_user.HasPermission("crm.leads.manage"))
            return Forbid();
        if (!_tenant.IsResolved)
            return BadRequest(new { error = "Tenant not resolved" });

        var tenantId = _tenant.TenantId!.Value;
        var token = await _db.GoogleOAuthTokens.FirstOrDefaultAsync(t => t.TenantId == tenantId, ct);
        if (token is null)
            return Ok(new { disconnected = true });

        try
        {
            if (!string.IsNullOrEmpty(token.RefreshToken))
                await _tokenProvider.RevokeAsync(token.RefreshToken!, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Best-effort Google token revocation failed for tenant {TenantId}", tenantId);
        }

        _db.GoogleOAuthTokens.Remove(token);

        var sources = await _db.LeadImportSources
            .Where(s => s.TenantId == tenantId && s.Status != LeadImportSourceStatus.Disconnected)
            .ToListAsync(ct);
        foreach (var s in sources) s.Status = LeadImportSourceStatus.Disconnected;

        await _db.SaveChangesAsync(ct);

        return Ok(new { disconnected = true });
    }

    private ContentResult HtmlError(int code, string msg)
    {
        var safe = System.Net.WebUtility.HtmlEncode(msg);
        return new ContentResult
        {
            StatusCode = code,
            ContentType = "text/html",
            Content = $"<!doctype html><meta charset=utf-8><p>{safe}</p>",
        };
    }
}
