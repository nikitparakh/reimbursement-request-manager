"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const [open, setOpen] = useState(false);

  async function executeRemove() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/members/${membershipId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Member removed");
        setOpen(false);
        router.refresh();
      } else {
        toast.error("Could not remove member");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next === false && saving) return;
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove member</AlertDialogTitle>
          <AlertDialogDescription>
            Remove <span className="font-medium text-foreground">{memberName}</span> from this team?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={saving}
            loading={saving}
            type="button"
            onClick={() => void executeRemove()}
          >
            Remove member
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
