using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using TravelCrm.Api.Features.Settings.DataReset.Commands;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Tests.Settings;

public class DataResetHandlerTests
{
    [Fact]
    public void Validator_requires_literal_RESET()
    {
        var v = new ResetTenantDataCommandValidator();

        v.Validate(new ResetTenantDataCommand("")).IsValid.Should().BeFalse();
        v.Validate(new ResetTenantDataCommand("reset")).IsValid.Should().BeFalse();
        v.Validate(new ResetTenantDataCommand("RESET")).IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Rejects_caller_without_permission()
    {
        var (db, tenant, _) = TestDb.New();

        var h = new ResetTenantDataCommandHandler(
            db, tenant,
            new FakeCurrentUser(Guid.NewGuid(), hasPermission: false),
            new CapturingActivityWriter(),
            NullLogger<ResetTenantDataCommandHandler>.Instance);

        var r = await h.Handle(new ResetTenantDataCommand("RESET"), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("permission");
    }

    [Fact]
    public async Task Rejects_unauthenticated_actor()
    {
        var (db, tenant, _) = TestDb.New();

        var h = new ResetTenantDataCommandHandler(
            db, tenant,
            new FakeCurrentUser(Guid.Empty),
            new CapturingActivityWriter(),
            NullLogger<ResetTenantDataCommandHandler>.Instance);

        var r = await h.Handle(new ResetTenantDataCommand("RESET"), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("Authenticated actor");
    }
}
