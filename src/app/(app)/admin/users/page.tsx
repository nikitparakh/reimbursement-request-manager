import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsersTable } from "@/components/admin/users-table";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) unauthorized();
  if (session.user.role !== "ADMIN") unauthorized();

  const [users, teams] = await Promise.all([
    db.user.findMany({
      include: {
        memberships: {
          include: { team: { select: { id: true, name: true } } },
          where: { approved: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const userRows = users.map((u) => ({
    id: u.id,
    name: u.name ?? "",
    email: u.email,
    role: u.role,
    memberships: u.memberships.map((m) => ({
      id: m.id,
      teamName: m.team.name,
      roleInTeam: m.roleInTeam,
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Users"
        badge={<Badge status={`${users.length} users`} />}
        description="View all users, change roles, and see team memberships."
      />

      <Card>
        <CardContent>
          <UsersTable users={userRows} teams={teams} />
        </CardContent>
      </Card>
    </div>
  );
}
