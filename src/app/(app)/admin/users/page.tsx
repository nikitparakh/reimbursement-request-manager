import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserRoleSelect } from "@/components/admin/user-role-select";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "ADMIN") unauthorized();

  const users = await db.user.findMany({
    include: {
      memberships: {
        include: { team: { select: { name: true } } },
        where: { approved: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Users"
        description="View all users, change roles, and see team memberships."
      />

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-3 pr-4 font-medium text-slate-500">Name</th>
                  <th className="pb-3 pr-4 font-medium text-slate-500">Email</th>
                  <th className="pb-3 pr-4 font-medium text-slate-500">Role</th>
                  <th className="pb-3 font-medium text-slate-500">Teams</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 text-slate-900">
                      {user.name || <span className="text-slate-400 italic">No name</span>}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{user.email}</td>
                    <td className="py-3 pr-4">
                      <UserRoleSelect userId={user.id} currentRole={user.role} />
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.memberships.length === 0 ? (
                          <span className="text-slate-400">None</span>
                        ) : (
                          user.memberships.map((m) => (
                            <Badge key={m.id} status={`${m.team.name} (${m.roleInTeam})`} />
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
