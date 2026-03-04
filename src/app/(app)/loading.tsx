import { PageSkeleton } from "@/components/ui/card-skeleton";

export default function DashboardLoading() {
  return <PageSkeleton cardCount={4} lines={2} />;
}
