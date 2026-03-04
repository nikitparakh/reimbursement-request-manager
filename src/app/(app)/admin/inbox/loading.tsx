import { PageSkeleton } from "@/components/ui/card-skeleton";

export default function AdminInboxLoading() {
  return <PageSkeleton cardCount={4} lines={3} />;
}
