import { PageSkeleton } from "@/components/ui/card-skeleton";

export default function CoachInboxLoading() {
  return <PageSkeleton cardCount={4} lines={4} />;
}
