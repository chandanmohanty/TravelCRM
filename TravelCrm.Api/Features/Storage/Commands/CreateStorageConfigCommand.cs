using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Storage.DTOs;
using TravelCrm.Api.Features.Storage.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Storage.Commands;

public sealed record CreateStorageConfigCommand(
    Guid?          TenantId,
    string         Name,
    StorageDriver  Driver,
    bool           IsActive,
    string?        BasePath,
    string?        AwsAccessKey,
    string?        AwsSecretKey,
    string?        AwsRegion,
    string?        AwsBucket,
    string?        AwsEndpoint,
    string?        AzureConnectionString,
    string?        AzureContainerName,
    string?        GcsServiceAccountJson,
    string?        GcsBucket,
    long?          MaxFileSizeBytes,
    string?        AllowedContentTypes)
    : IRequest<Result<StorageConfigDto>>;

public sealed class CreateStorageConfigCommandValidator : AbstractValidator<CreateStorageConfigCommand>
{
    public CreateStorageConfigCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Driver).IsInEnum();

        // S3 requires key + secret + region + bucket
        When(x => x.Driver == StorageDriver.AmazonS3, () =>
        {
            RuleFor(x => x.AwsAccessKey).NotEmpty().WithMessage("AWS Access Key is required.");
            RuleFor(x => x.AwsSecretKey).NotEmpty().WithMessage("AWS Secret Key is required.");
            RuleFor(x => x.AwsRegion).NotEmpty().WithMessage("AWS Region is required.");
            RuleFor(x => x.AwsBucket).NotEmpty().WithMessage("S3 Bucket is required.");
        });

        // Azure requires connection string + container
        When(x => x.Driver == StorageDriver.AzureBlob, () =>
        {
            RuleFor(x => x.AzureConnectionString).NotEmpty().WithMessage("Connection string is required.");
            RuleFor(x => x.AzureContainerName).NotEmpty().WithMessage("Container name is required.");
        });

        // GCS requires service account + bucket
        When(x => x.Driver == StorageDriver.GoogleCloudStorage, () =>
        {
            RuleFor(x => x.GcsServiceAccountJson).NotEmpty().WithMessage("Service account JSON is required.");
            RuleFor(x => x.GcsBucket).NotEmpty().WithMessage("GCS bucket is required.");
        });
    }
}

public sealed class CreateStorageConfigCommandHandler(
    ApplicationDbContext db,
    ICurrentUser currentUser,
    ILogger<CreateStorageConfigCommandHandler> logger)
    : IRequestHandler<CreateStorageConfigCommand, Result<StorageConfigDto>>
{
    public async Task<Result<StorageConfigDto>> Handle(CreateStorageConfigCommand cmd, CancellationToken ct)
    {
        // Check name uniqueness within scope
        var nameExists = await db.StorageConfigurations
            .AnyAsync(c => c.TenantId == cmd.TenantId && c.Name == cmd.Name, ct);
        if (nameExists)
            return Result.Failure<StorageConfigDto>($"A storage configuration named '{cmd.Name}' already exists.");

        // If setting as active, deactivate others in the same scope
        if (cmd.IsActive)
        {
            await DeactivateAllForScope(cmd.TenantId, ct);
        }

        var userId = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;
        var row = new StorageConfiguration
        {
            Id                     = Guid.NewGuid(),
            TenantId               = cmd.TenantId,
            Name                   = cmd.Name,
            Driver                 = cmd.Driver,
            IsActive               = cmd.IsActive,
            BasePath               = cmd.BasePath,
            AwsAccessKey           = cmd.AwsAccessKey,
            AwsSecretKey           = cmd.AwsSecretKey,
            AwsRegion              = cmd.AwsRegion,
            AwsBucket              = cmd.AwsBucket,
            AwsEndpoint            = cmd.AwsEndpoint,
            AzureConnectionString  = cmd.AzureConnectionString,
            AzureContainerName     = cmd.AzureContainerName,
            GcsServiceAccountJson  = cmd.GcsServiceAccountJson,
            GcsBucket              = cmd.GcsBucket,
            MaxFileSizeBytes       = cmd.MaxFileSizeBytes ?? 5 * 1024 * 1024,
            AllowedContentTypes    = cmd.AllowedContentTypes
                ?? "image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon,image/vnd.microsoft.icon",
            CreatedAt              = DateTime.UtcNow,
            CreatedBy              = userId
        };

        db.StorageConfigurations.Add(row);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Storage config '{Name}' (driver={Driver}) created for scope {Scope}",
            row.Name, row.Driver, row.TenantId?.ToString() ?? "platform");

        return Result.Success(GetStorageConfigsQueryHandler.ToMaskedDto(row));
    }

    private async Task DeactivateAllForScope(Guid? tenantId, CancellationToken ct)
    {
        var activeConfigs = await db.StorageConfigurations
            .Where(c => c.TenantId == tenantId && c.IsActive)
            .ToListAsync(ct);

        foreach (var c in activeConfigs)
            c.IsActive = false;
    }
}
