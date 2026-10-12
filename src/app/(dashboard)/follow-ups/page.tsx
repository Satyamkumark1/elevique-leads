import { EmptyState } from "@/components/empty-state";

export default function FollowUpsPage() {
  return (
    <EmptyState
      title="No follow-ups scheduled"
      body="Sequences stop automatically when a lead replies or is paused."
    />
  );
}
