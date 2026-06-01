import { unauthorized } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { ProfileForm } from "@/components/profile/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BackLink } from "@/components/ui/back-link";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) unauthorized();

  const profile = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: {
      mailingAddressLine1: true,
      mailingAddressLine2: true,
      mailingCity: true,
      mailingState: true,
      mailingPostalCode: true,
      zelleType: true,
      zelleValue: true,
      policyAcceptedAt: true,
      policyVersion: true,
    },
  });

  if (!profile) unauthorized();

  return (
    <div className="space-y-6">
      <BackLink href="/" label="Back to dashboard" />
      <PageHeader
        title="Profile"
        description="Keep your reimbursement contact details current."
      />

      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
          <CardDescription>Mailing address and Zelle information used for reimbursement.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm initialProfile={profile} />
        </CardContent>
      </Card>
    </div>
  );
}
