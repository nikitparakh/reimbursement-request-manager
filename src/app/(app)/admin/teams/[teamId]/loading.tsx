import { PageSkeleton } from "@/components/ui/card-skeleton";

export default function TeamDetailLoading() {
  return <PageSkeleton cardCount={4} lines={3} />;
}
