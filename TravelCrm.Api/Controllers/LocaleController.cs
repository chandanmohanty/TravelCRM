using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Identity.Commands;
using TravelCrm.Api.Infrastructure.Localization;

namespace TravelCrm.Api.Controllers;

[ApiController]
[Route("api/locale")]
public class LocaleController(IMediator mediator) : ControllerBase
{
    [HttpGet("supported")]
    [AllowAnonymous]
    public IActionResult GetSupportedLocales()
    {
        return Ok(new
        {
            Languages = SupportedCultures.Languages.Select(l => new { l.Code, l.Name, l.Rtl }),
            Timezones = new[]
            {
                new { Id = "Asia/Kolkata", Label = "(UTC+05:30) India Standard Time" },
                new { Id = "Asia/Dubai", Label = "(UTC+04:00) Gulf Standard Time" },
                new { Id = "UTC", Label = "(UTC+00:00) Coordinated Universal Time" },
                new { Id = "America/New_York", Label = "(UTC-05:00) Eastern Time" },
                new { Id = "Europe/London", Label = "(UTC+00:00) Greenwich Mean Time" },
                new { Id = "Asia/Tokyo", Label = "(UTC+09:00) Japan Standard Time" },
                new { Id = "Australia/Sydney", Label = "(UTC+11:00) Australian Eastern Time" },
            },
            Currencies = new[]
            {
                new { Code = "INR", Name = "Indian Rupee", Symbol = "\u20b9" },
                new { Code = "AED", Name = "UAE Dirham", Symbol = "\u062f.\u0625" },
                new { Code = "USD", Name = "US Dollar", Symbol = "$" },
                new { Code = "EUR", Name = "Euro", Symbol = "\u20ac" },
                new { Code = "GBP", Name = "British Pound", Symbol = "\u00a3" },
            }
        });
    }

    [HttpPut("user")]
    [Authorize]
    public async Task<IActionResult> UpdateUserLocale([FromBody] UpdateLocaleRequest request)
    {
        var result = await mediator.Send(new UpdateUserLocaleCommand(
            request.Language, request.TimeZone, request.CurrencyCode));
        return result.IsSuccess
            ? Ok(new { Message = "Locale preferences updated" })
            : BadRequest(new { Error = result.Error });
    }
}

public record UpdateLocaleRequest(string? Language, string? TimeZone, string? CurrencyCode);
