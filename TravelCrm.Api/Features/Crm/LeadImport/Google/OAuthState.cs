using System.Security.Cryptography;
using System.Text;

namespace TravelCrm.Api.Features.Crm.LeadImport.Google;

/// <summary>
/// Opaque OAuth `state`: base64url(tenantId|nonce|expUnix) + "." +
/// base64url(HMACSHA256(payload, key)). Binds the callback to the tenant
/// (anti-CSRF) and expires.
/// </summary>
public static class OAuthState
{
    public static string Create(Guid tenantId, byte[] key, DateTimeOffset exp)
    {
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(8));
        var payload = $"{tenantId:N}|{nonce}|{exp.ToUnixTimeSeconds()}";
        var sig = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(payload));
        return $"{B64(Encoding.UTF8.GetBytes(payload))}.{B64(sig)}";
    }

    public static bool TryValidate(string state, byte[] key, DateTimeOffset now, out Guid tenantId)
    {
        tenantId = Guid.Empty;
        if (string.IsNullOrWhiteSpace(state)) return false;
        var parts = state.Split('.');
        if (parts.Length != 2) return false;
        byte[] payloadBytes, sig;
        try { payloadBytes = UnB64(parts[0]); sig = UnB64(parts[1]); }
        catch { return false; }
        var expected = HMACSHA256.HashData(key, payloadBytes);
        if (!CryptographicOperations.FixedTimeEquals(expected, sig)) return false;
        var fields = Encoding.UTF8.GetString(payloadBytes).Split('|');
        if (fields.Length != 3) return false;
        if (!Guid.TryParseExact(fields[0], "N", out var tid)) return false;
        if (!long.TryParse(fields[2], out var expUnix)) return false;
        if (DateTimeOffset.FromUnixTimeSeconds(expUnix) < now) return false;
        tenantId = tid;
        return true;
    }

    private static string B64(byte[] b) =>
        Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static byte[] UnB64(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        s = s.PadRight(s.Length + (4 - s.Length % 4) % 4, '=');
        return Convert.FromBase64String(s);
    }
}
