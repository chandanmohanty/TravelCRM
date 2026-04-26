using FluentAssertions;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Features.Inventory.Calendar;

namespace TravelCrm.Tests.Inventory;

public class AvailabilityCalculationTests
{
    private static PoolResource Pool(int defaultCapacity = 10) => new()
    {
        Id = Guid.NewGuid(), TenantId = Guid.NewGuid(),
        Type = "RoomType", Name = "X",
        DefaultCapacity = defaultCapacity, Status = ResourceStatus.Active,
    };

    private static AssetResource Asset() => new()
    {
        Id = Guid.NewGuid(), TenantId = Guid.NewGuid(),
        Type = "Vehicle", Name = "X", Status = ResourceStatus.Active,
    };

    private static DateOnly D(int month, int day) => new(2026, month, day);

    [Fact]
    public void Pool_NoOverridesNoHolds_AllowsUpToDefaultCapacity()
    {
        var r = Pool(10);
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), Array.Empty<ResourceHold>(),
            D(5, 1), D(5, 1), null, requestedQuantity: 10);

        result.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Pool_ExceedingDefaultCapacity_RejectsWithFirstFailingDate()
    {
        var r = Pool(10);
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), Array.Empty<ResourceHold>(),
            D(5, 1), D(5, 1), null, requestedQuantity: 11);

        result.IsAvailable.Should().BeFalse();
        result.FailingDate.Should().Be(D(5, 1));
        result.Reason.Should().Contain("capacity");
    }

    [Fact]
    public void Pool_CalendarOverrideIncreasesCapacity()
    {
        var r = Pool(10);
        var overrides = new[]
        {
            new ResourceCalendar { ResourceId = r.Id, Date = D(5, 1), Slot = null, Capacity = 20 },
        };
        var result = AvailabilityCalculator.Check(
            r, overrides, Array.Empty<ResourceHold>(),
            D(5, 1), D(5, 1), null, requestedQuantity: 15);

        result.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Pool_BlockedDateInRange_Rejects()
    {
        var r = Pool(10);
        var overrides = new[]
        {
            new ResourceCalendar { ResourceId = r.Id, Date = D(5, 2), Slot = null, Capacity = 10, IsBlocked = true },
        };
        var result = AvailabilityCalculator.Check(
            r, overrides, Array.Empty<ResourceHold>(),
            D(5, 1), D(5, 3), null, requestedQuantity: 1);

        result.IsAvailable.Should().BeFalse();
        result.FailingDate.Should().Be(D(5, 2));
        result.Reason.Should().Contain("blocked");
    }

    [Fact]
    public void Pool_OverlappingHolds_SubtractFromCapacity()
    {
        var r = Pool(10);
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 3),
                               Slot = null, Quantity = 7, Status = ResourceHoldStatus.Confirmed },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 2), D(5, 2), null, requestedQuantity: 4);

        result.IsAvailable.Should().BeFalse();
        result.Reason.Should().Contain("capacity");
    }

    [Fact]
    public void Pool_ReleasedAndExpiredHolds_AreIgnored()
    {
        var r = Pool(10);
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 1),
                               Quantity = 7, Status = ResourceHoldStatus.Released },
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 1),
                               Quantity = 5, Status = ResourceHoldStatus.Expired },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 1), D(5, 1), null, requestedQuantity: 10);

        result.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Asset_NoHolds_AllowsOne()
    {
        var r = Asset();
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), Array.Empty<ResourceHold>(),
            D(5, 1), D(5, 1), null, requestedQuantity: 1);

        result.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Asset_AnyExistingHold_RejectsSecondHold()
    {
        var r = Asset();
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 1),
                               Quantity = 1, Status = ResourceHoldStatus.Held },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 1), D(5, 1), null, requestedQuantity: 1);

        result.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public void Slot_MorningHoldsDoNotConflictWithAfternoonRequest()
    {
        var r = Pool(1);
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 1),
                               Slot = ResourceCalendarSlot.Morning, Quantity = 1, Status = ResourceHoldStatus.Held },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 1), D(5, 1), ResourceCalendarSlot.Afternoon, requestedQuantity: 1);

        result.IsAvailable.Should().BeTrue();
    }

    [Fact]
    public void Slot_WholeDayHoldBlocksSlotRequest()
    {
        var r = Pool(1);
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 1),
                               Slot = null, Quantity = 1, Status = ResourceHoldStatus.Held },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 1), D(5, 1), ResourceCalendarSlot.Morning, requestedQuantity: 1);

        result.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public void Slot_SlotHoldBlocksWholeDayRequest()
    {
        var r = Pool(1);
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 1),
                               Slot = ResourceCalendarSlot.Morning, Quantity = 1, Status = ResourceHoldStatus.Held },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 1), D(5, 1), null, requestedQuantity: 1);

        result.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public void BackToBackHolds_DoNotConflict()
    {
        // Hold 1: D(5,1) to D(5,3). Hold 2: D(5,4) to D(5,6). Adjacent, not overlapping.
        var r = Asset();
        var holds = new[]
        {
            new ResourceHold { ResourceId = r.Id, StartDate = D(5, 1), EndDate = D(5, 3),
                               Quantity = 1, Status = ResourceHoldStatus.Confirmed },
        };
        var result = AvailabilityCalculator.Check(
            r, Array.Empty<ResourceCalendar>(), holds,
            D(5, 4), D(5, 6), null, requestedQuantity: 1);

        result.IsAvailable.Should().BeTrue();
    }
}
