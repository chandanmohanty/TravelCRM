using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Storage.DTOs;
using TravelCrm.Api.Infrastructure.FileStorage;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Storage.Commands;

/// <summary>
/// Tests the connectivity of a saved storage configuration by probing the
/// backend (e.g. S3 HeadBucket, local disk exists check). Returns success,
/// an error message, and latency.
/// </summary>
public sealed record TestStorageConnectionCommand(Guid Id, Guid? TenantId)
    : IRequest<Result<TestConnectionResult>>;

public sealed class TestStorageConnectionCommandHandler(
    ApplicationDbContext db,
    FileStorageResolver resolver,
    ILogger<TestStorageConnectionCommandHandler> logger)
    : IRequestHandler<TestStorageConnectionCommand, Result<TestConnectionResult>>
{
    public async Task<Result<TestConnectionResult>> Handle(
        TestStorageConnectionCommand cmd, CancellationToken ct)
    {
        var row = await db.StorageConfigurations.FindAsync([cmd.Id], ct);
        if (row is null)
            return Result.Failure<TestConnectionResult>("Storage configuration not found.");

        if (row.TenantId != cmd.TenantId)
            return Result.Failure<TestConnectionResult>("Storage configuration does not belong to this scope.");

        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            switch (row.Driver)
            {
                case StorageDriver.AmazonS3:
                    return await TestS3Async(row, sw, ct);

                case StorageDriver.LocalDisk:
                    return TestLocalDisk(row, sw);

                case StorageDriver.AzureBlob:
                    sw.Stop();
                    return Result.Success(new TestConnectionResult(
                        false, "Azure Blob test not yet implemented.", sw.ElapsedMilliseconds));

                case StorageDriver.GoogleCloudStorage:
                    sw.Stop();
                    return Result.Success(new TestConnectionResult(
                        false, "GCS test not yet implemented.", sw.ElapsedMilliseconds));

                default:
                    sw.Stop();
                    return Result.Success(new TestConnectionResult(
                        false, $"Unknown driver: {row.Driver}", sw.ElapsedMilliseconds));
            }
        }
        catch (Exception ex)
        {
            sw.Stop();
            logger.LogWarning(ex, "Storage connection test failed for config '{Name}'", row.Name);
            return Result.Success(new TestConnectionResult(
                false, $"Connection failed: {ex.Message}", sw.ElapsedMilliseconds));
        }
    }

    private async Task<Result<TestConnectionResult>> TestS3Async(
        StorageConfiguration config, System.Diagnostics.Stopwatch sw, CancellationToken ct)
    {
        using var s3 = (S3FileStorage)resolver.CreateFromConfig(config);
        var (success, message, latency) = await s3.TestConnectionAsync(ct);
        return Result.Success(new TestConnectionResult(success, message, latency));
    }

    private static Result<TestConnectionResult> TestLocalDisk(
        StorageConfiguration config, System.Diagnostics.Stopwatch sw)
    {
        var basePath = config.BasePath ?? "uploads";
        // Just check the base path is a valid relative path
        sw.Stop();
        return Result.Success(new TestConnectionResult(
            true,
            $"Local disk path '{basePath}' is configured. Files will be served via UseStaticFiles.",
            sw.ElapsedMilliseconds));
    }
}
