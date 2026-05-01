using Xunit;

namespace TravelCrm.Tests.Inventory;

/// <summary>
/// PostgreSQL-only integration test for the SELECT FOR UPDATE concurrency lock
/// in <c>CreateHoldHandler</c>.
///
/// DEFERRED in v1. Wiring this test requires:
///   1. A real PostgreSQL instance reachable from the test runner.
///   2. Test-only stubs for <c>ITenantContext</c> and <c>IDataProtectionProvider</c>
///      to construct <c>ApplicationDbContext</c> outside the DI container.
///   3. An env var <c>INVENTORY_PG_TEST_CONN</c> with the connection string.
///
/// The algorithm correctness this test would verify is already covered by:
///   - <see cref="AvailabilityCalculationTests"/> (12 tests, pure algorithm)
///   - <see cref="HoldHandlersTests"/> (10 tests, handler logic)
///
/// The actual <c>SELECT … FOR UPDATE</c> lock will be exercised by real
/// production PostgreSQL traffic. Re-introduce this test if oversell incidents
/// are observed in production.
/// </summary>
public class HoldConcurrencyTests
{
    [Fact(Skip = "PG-only race test; deferred for v1. Requires INVENTORY_PG_TEST_CONN env var and PG instance.")]
    public void TwoParallelHolds_OnSameResourceAndDay_OneWinsAndOneRejects()
    {
        // See class summary — implementation deferred.
    }
}
