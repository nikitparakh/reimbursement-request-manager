import { PageSkeleton } from "@/components/ui/card-skeleton";

export default function UserRequestsLoading() {
  return <PageSkeleton cardCount={5} lines={3} />;
}
