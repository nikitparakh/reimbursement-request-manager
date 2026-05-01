import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/profile/profile-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) unauthorized();

  const profile = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
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
      <PageHeader
        title="Profile"
        description="Keep your reimbursement contact details current."
      />

      <Card>
        <CardContent>
          <ProfileForm initialProfile={profile} />
        </CardContent>
      </Card>
    </div>
  );
}
