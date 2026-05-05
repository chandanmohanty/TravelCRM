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

public sealed record UpdateStorageConfigCommand(
    Guid           Id,
    Guid?          TenantId,
    string         Name,
    StorageDriver  Driver,
    bool           IsActive,
    string?        BasePath,
    string?        AwsAccessKey,
    string?        AwsSecretKey,     // "***..." = keep existing
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

public sealed class UpdateStorageConfigCommandValidator : AbstractValidator<UpdateStorageConfigCommand>
{
    public UpdateStorageConfigCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Driver).IsInEnum();

        When(x => x.Driver == StorageDriver.AmazonS3, () =>
        {
            RuleFor(x => x.AwsAccessKey).NotEmpty().WithMessage("AWS Access Key is required.");
            // Secret can be "***..." (keep existing) or a new value
            RuleFor(x => x.AwsSecretKey).NotEmpty().WithMessage("AWS Secret Key is required.");
            RuleFor(x => x.AwsRegion).NotEmpty().WithMessage("AWS Region is required.");
            RuleFor(x => x.AwsBucket).NotEmpty().WithMessage("S3 Bucket is required.");
        });

        When(x => x.Driver == StorageDriver.AzureBlob, () =>
        {
            RuleFor(x => x.AzureConnectionString).NotEmpty();
            RuleFor(x => x.AzureContainerName).NotEmpty();
        });

        When(x => x.Driver == StorageDriver.GoogleCloudStorage, () =>
        {
            RuleFor(x => x.GcsServiceAccountJson).NotEmpty();
            RuleFor(x => x.GcsBucket).NotEmpty();
        });
    }
}

public sealed class UpdateStorageConfigCommandHandler(
    ApplicationDbContext db,
    ICurrentUser currentUser,
    ILogger<UpdateStorageConfigCommandHandler> logger)
    : IRequestHandler<UpdateStorageConfigCommand, Result<StorageConfigDto>>
{
    public async Task<Result<StorageConfigDto>> Handle(UpdateStorageConfigCommand cmd, CancellationToken ct)
    {
        var row = await db.StorageConfigurations.FindAsync([cmd.Id], ct);
        if (row is null)
            return Result.Failure<StorageConfigDto>("Storage configuration not found.");

        // Scope guard: ensure the config belongs to the expected scope
        if (row.TenantId != cmd.TenantId)
            return Result.Failure<StorageConfigDto>("Storage configuration does not belong to this scope.");

        // Name uniqueness (excluding self)
        var nameTaken = await db.StorageConfigurations
            .AnyAsync(c => c.TenantId == cmd.TenantId && c.Name == cmd.Name && c.Id != cmd.Id, ct);
        if (nameTaken)
            return Result.Failure<StorageConfigDto>($"Name '{cmd.Name}' is already taken.");

        // If setting as active, deactivate others
        if (cmd.IsActive && !row.IsActive)
        {
            var others = await db.StorageConfigurations
                .Where(c => c.TenantId == cmd.TenantId && c.IsActive && c.Id != cmd.Id)
                .ToListAsync(ct);
            foreach (var o in others) o.IsActive = false;
        }

        var userId = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;

        row.Name                   = cmd.Name;
        row.Driver                 = cmd.Driver;
        row.IsActive               = cmd.IsActive;
        row.BasePath               = cmd.BasePath;
        row.AwsAccessKey           = cmd.AwsAccessKey;
        row.AwsSecretKey           = CredentialMask.Resolve(cmd.AwsSecretKey, row.AwsSecretKey);
        row.AwsRegion              = cmd.AwsRegion;
        row.AwsBucket              = cmd.AwsBucket;
        row.AwsEndpoint            = cmd.AwsEndpoint;
        row.AzureConnectionString  = CredentialMask.Resolve(cmd.AzureConnectionString, row.AzureConnectionString);
        row.AzureContainerName     = cmd.AzureContainerName;
        row.GcsServiceAccountJson  = CredentialMask.Resolve(cmd.GcsServiceAccountJson, row.GcsServiceAccountJson);
        row.GcsBucket              = cmd.GcsBucket;
        row.MaxFileSizeBytes       = cmd.MaxFileSizeBytes ?? row.MaxFileSizeBytes;
        row.AllowedContentTypes    = cmd.AllowedContentTypes ?? row.AllowedContentTypes;
        row.UpdatedAt              = DateTime.UtcNow;
        row.UpdatedBy              = userId;

        await db.SaveChangesAsync(ct);

        logger.LogInformation("Storage config '{Name}' updated for scope {Scope}",
            row.Name, row.TenantId?.ToString() ?? "platform");

        return Result.Success(GetStorageConfigsQueryHandler.ToMaskedDto(row));
    }
}
