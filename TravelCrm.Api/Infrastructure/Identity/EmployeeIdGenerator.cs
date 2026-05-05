using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Identity;

/// <summary>
/// Allocates monotonic per-tenant per-year employee IDs in the form
/// <c>EMP-{YYYY}-{NNNNNN}</c>.
///
/// Concurrency safety: a single PostgreSQL statement
/// (<c>INSERT … ON CONFLICT DO UPDATE RETURNING</c>) atomically initialises
/// the per-(tenant, year) row and returns the allocated value, so no
/// row-level lock or retry loop is needed.
///
/// The statement is executed directly against the underlying ADO.NET
/// connection because EF's <c>SqlQuery</c>/<c>FromSql</c> reject this
/// "non-composable" statement shape.
///
/// Scoped service. Call <see cref="NextAsync"/> once per user create.
/// </summary>
public sealed class EmployeeIdGenerator(ApplicationDbContext db)
{
    private const string Sql = """
        INSERT INTO employee_id_sequences (tenant_id, year, next_value)
        VALUES (@tid, @year, 2)
        ON CONFLICT (tenant_id, year) DO UPDATE
            SET next_value = employee_id_sequences.next_value + 1
        RETURNING employee_id_sequences.next_value - 1;
        """;

    public async Task<string> NextAsync(Guid tenantId, CancellationToken ct = default)
    {
        var year = DateTime.UtcNow.Year;

        var conn = db.Database.GetDbConnection();
        var opened = false;
        if (conn.State != ConnectionState.Open)
        {
            await conn.OpenAsync(ct);
            opened = true;
        }

        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = Sql;
            cmd.Parameters.Add(new NpgsqlParameter("@tid",  tenantId));
            cmd.Parameters.Add(new NpgsqlParameter("@year", year));

            // If EF has an active transaction, enlist this command on the same tx
            if (db.Database.CurrentTransaction?.GetDbTransaction() is { } tx)
                cmd.Transaction = tx;

            var boxed = await cmd.ExecuteScalarAsync(ct);
            var allocated = Convert.ToInt32(boxed);
            return $"EMP-{year}-{allocated:D6}";
        }
        finally
        {
            if (opened) await conn.CloseAsync();
        }
    }
}
