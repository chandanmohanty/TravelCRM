namespace TravelCrm.Api.Common;

public static class Permissions
{
    public static class Users
    {
        public const string Read = "users.read";
        public const string Create = "users.create";
        public const string Update = "users.update";
        public const string Delete = "users.delete";
        public const string Deactivate = "users.deactivate";
        public const string AssignRole = "users.assign_role";
    }

    public static class Roles
    {
        public const string Read = "roles.read";
        public const string Create = "roles.create";
        public const string Update = "roles.update";
        public const string Delete = "roles.delete";
    }

    public static class Audit
    {
        public const string Read = "audit.read";
    }

    public static readonly string[] SuperAdminPermissions = new[]
    {
        Users.Read, Users.Create, Users.Update, Users.Delete, Users.Deactivate, Users.AssignRole,
        Roles.Read, Roles.Create, Roles.Update, Roles.Delete,
        Audit.Read,
    };

    public static readonly string[] AdminPermissions = new[]
    {
        Users.Read, Users.Create, Users.Update, Users.Deactivate, Users.AssignRole,
        Roles.Read,
        Audit.Read,
    };

    public static readonly string[] ManagerPermissions = new[]
    {
        Users.Read,
        Roles.Read,
    };

    public static readonly string[] ReadOnlyPermissions = new[]
    {
        Users.Read,
        Roles.Read,
    };
}
