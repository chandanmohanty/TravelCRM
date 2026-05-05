using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Auth.DTOs;

namespace TravelCrm.Api.Features.Auth.Commands.Login;

public sealed record LoginCommand(string Email, string Password, string IpAddress) : IRequest<Result<LoginResponse>>;
