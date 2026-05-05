using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Auth.DTOs;

namespace TravelCrm.Api.Features.Auth.Commands.Refresh;

public sealed record RefreshCommand(string RefreshToken, string IpAddress) : IRequest<Result<LoginResponse>>;
