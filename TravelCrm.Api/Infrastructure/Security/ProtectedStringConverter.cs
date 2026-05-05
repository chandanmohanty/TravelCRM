using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace TravelCrm.Api.Infrastructure.Security;

/// <summary>
/// EF Core value converter that transparently encrypts a string property at
/// rest using ASP.NET Core Data Protection. Store provider secrets (API keys,
/// OAuth refresh tokens, passwords) as a plain <c>string</c> property on the
/// entity and wire this converter in <c>OnModelCreating</c>:
/// <code>
///   b.Property(x => x.ApiKey).HasConversion(protectedConverter);
/// </code>
/// Values are base64-encoded ciphertext — safe to round-trip through Postgres
/// text/varchar columns. A <c>null</c> or empty value passes through unchanged.
///
/// The purpose string <c>travelcrm.secret.v1</c> is baked into the key ring —
/// rotating it invalidates all previously-stored ciphertext, so don't.
/// </summary>
public sealed class ProtectedStringConverter : ValueConverter<string?, string?>
{
    public const string Purpose = "travelcrm.secret.v1";

    public ProtectedStringConverter(IDataProtectionProvider provider)
        : base(
            plain       => Encrypt(provider, plain),
            ciphertext  => Decrypt(provider, ciphertext))
    { }

    private static string? Encrypt(IDataProtectionProvider provider, string? plain)
    {
        if (string.IsNullOrEmpty(plain)) return plain;
        return provider.CreateProtector(Purpose).Protect(plain);
    }

    private static string? Decrypt(IDataProtectionProvider provider, string? ciphertext)
    {
        if (string.IsNullOrEmpty(ciphertext)) return ciphertext;
        try
        {
            return provider.CreateProtector(Purpose).Unprotect(ciphertext);
        }
        catch (System.Security.Cryptography.CryptographicException)
        {
            // Ciphertext was written with a purpose or key that no longer exists
            // (for example, pre-encryption data migrated into an encrypted column).
            // Fail open with the raw value so the caller can re-save it and fix
            // the row, rather than blowing up every read.
            return ciphertext;
        }
    }
}
