using System.Reflection;
using FluentAssertions;
using NetArchTest.Rules;

namespace TravelCrm.Tests.Architecture;

/// <summary>
/// Architecture invariants (rule 1 — clean architecture; rule 4 — thin controllers).
/// These guard against regressions across the whole API assembly.
/// </summary>
public class ArchitectureTests
{
    private static readonly Assembly Api =
        typeof(TravelCrm.Api.Common.Result).Assembly;

    [Fact]
    public void Domain_must_not_depend_on_infrastructure_or_features()
    {
        var result = Types.InAssembly(Api)
            .That().ResideInNamespace("TravelCrm.Api.Domain")
            .ShouldNot().HaveDependencyOnAny(
                "TravelCrm.Api.Infrastructure",
                "TravelCrm.Api.Features",
                "TravelCrm.Api.Controllers",
                "Microsoft.EntityFrameworkCore")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            "Domain entities must not depend on Infrastructure, Features, Controllers, or EF Core. Offenders: {0}",
            string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>()));
    }

    [Fact]
    public void Controllers_must_not_reference_DbContext_directly()
    {
        var result = Types.InAssembly(Api)
            .That().ResideInNamespace("TravelCrm.Api.Controllers")
            .ShouldNot().HaveDependencyOn("TravelCrm.Api.Infrastructure.Persistence.ApplicationDbContext")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            "Controllers must be thin — route through MediatR, not DbContext. Offenders: {0}",
            string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>()));
    }

    [Fact]
    public void Command_and_query_handlers_must_be_sealed()
    {
        var result = Types.InAssembly(Api)
            .That().ImplementInterface(typeof(MediatR.IRequestHandler<,>))
            .Or().ImplementInterface(typeof(MediatR.IRequestHandler<>))
            .Should().BeSealed()
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            "All MediatR handlers must be sealed. Offenders: {0}",
            string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>()));
    }
}
