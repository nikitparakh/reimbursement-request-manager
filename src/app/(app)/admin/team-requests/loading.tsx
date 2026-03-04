import { PageSkeleton } from "@/components/ui/card-skeleton";

export default function TeamRequestsLoading() {
  return <PageSkeleton cardCount={3} lines={2} />;
}
