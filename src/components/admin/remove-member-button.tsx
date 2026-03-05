"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type RemoveMemberButtonProps = {
  teamId: string;
  membershipId: string;
  memberName: string;
};

export function RemoveMemberButton({
  teamId,
  membershipId,
  memberName,
}: RemoveMemberButtonProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleRemove() {
    if (!confirm(`Remove ${memberName} from this team?`)) return;

    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/teams/${teamId}/members/${membershipId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRemove}
      loading={saving}
      className="text-red-600 hover:text-red-700 hover:bg-red-50"
    >
      Remove
    </Button>
  );
}
