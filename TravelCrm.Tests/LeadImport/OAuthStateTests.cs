using System.Security.Cryptography;
using TravelCrm.Api.Features.Crm.LeadImport.Google;
using Xunit;

namespace TravelCrm.Tests.LeadImport;

public sealed class OAuthStateTests
{
    private static readonly byte[] Key = RandomNumberGenerator.GetBytes(32);

    [Fact]
    public void Roundtrip_valid_state_returns_tenant()
    {
        var tenant = Guid.NewGuid();
        var s = OAuthState.Create(tenant, Key, DateTimeOffset.UtcNow.AddMinutes(10));
        Assert.True(OAuthState.TryValidate(s, Key, DateTimeOffset.UtcNow, out var got));
        Assert.Equal(tenant, got);
    }

    [Fact]
    public void Tampered_state_is_rejected()
    {
        var s = OAuthState.Create(Guid.NewGuid(), Key, DateTimeOffset.UtcNow.AddMinutes(10));
        var bad = s[..^2] + (s[^1] == 'A' ? "B" : "A");
        Assert.False(OAuthState.TryValidate(bad, Key, DateTimeOffset.UtcNow, out _));
    }

    [Fact]
    public void Expired_state_is_rejected()
    {
        var s = OAuthState.Create(Guid.NewGuid(), Key, DateTimeOffset.UtcNow.AddMinutes(-1));
        Assert.False(OAuthState.TryValidate(s, Key, DateTimeOffset.UtcNow, out _));
    }

    [Fact]
    public void Wrong_key_is_rejected()
    {
        var s = OAuthState.Create(Guid.NewGuid(), Key, DateTimeOffset.UtcNow.AddMinutes(10));
        Assert.False(OAuthState.TryValidate(s, RandomNumberGenerator.GetBytes(32), DateTimeOffset.UtcNow, out _));
    }
}
