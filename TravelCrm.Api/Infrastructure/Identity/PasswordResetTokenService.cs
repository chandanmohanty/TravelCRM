using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Identity;

/// <summary>
/// Service for creating + consuming password-reset / invite tokens.
/// Only the SHA-256 hash of the raw token is persisted; the raw value
/// travels only in the email link.
/// </summary>
public sealed class PasswordResetTokenService(ApplicationDbContext db)
{
    private const int TokenByteLen = 32;

    /// <summary>
    /// Mint a new token for the given user. Returns the raw token (to be
    /// embedded in the email link) and the full reset URL.
    /// </summary>
    public async Task<(string RawToken, string Url)> CreateAsync(
        Guid userId,
        Guid? tenantId,
        TimeSpan validFor,
        string appBaseUrl,
        string? ipAddress = null,
        CancellationToken ct = default)
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(TokenByteLen))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');
        var hash = HashToken(raw);

        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id        = Guid.NewGuid(),
            UserId    = userId,
            TenantId  = tenantId,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.Add(validFor),
            CreatedAt = DateTime.UtcNow,
            IpAddress = ipAddress
        });
        await db.SaveChangesAsync(ct);

        var url = $"{appBaseUrl.TrimEnd('/')}/authentication/reset-password?uid={userId}&token={Uri.EscapeDataString(raw)}";
        return (raw, url);
    }

    /// <summary>
    /// Look up a token by raw value, validate it (not expired, not consumed,
    /// matching user), and mark it consumed. Returns the UserId on success.
    /// </summary>
    public async Task<(bool Ok, string? Error, Guid UserId)> ConsumeAsync(
        Guid uid, string rawToken, CancellationToken ct = default)
    {
        var hash = HashToken(rawToken);

        var row = await db.PasswordResetTokens
            .FirstOrDefaultAsync(t => t.TokenHash == hash && t.UserId == uid, ct);

        if (row is null)
            return (false, "Invalid or unknown reset token.", Guid.Empty);
        if (row.ConsumedAt is not null)
            return (false, "This reset link has already been used.", Guid.Empty);
        if (row.ExpiresAt <= DateTime.UtcNow)
            return (false, "This reset link has expired. Please request a new one.", Guid.Empty);

        row.ConsumedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return (true, null, row.UserId);
    }

    private static string HashToken(string raw)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes);
    }
}
