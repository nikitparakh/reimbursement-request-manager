import { PageSkeleton } from "@/components/ui/card-skeleton";

export default function ManagerInboxLoading() {
  return <PageSkeleton cardCount={4} lines={4} />;
}
