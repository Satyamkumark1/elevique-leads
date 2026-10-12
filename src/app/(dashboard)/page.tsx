import { EmptyState } from "@/components/empty-state";

export default function OverviewPage() {
  return (
    <EmptyState
      title="No leads yet"
      body="Connect your Meta Page to start receiving leads."
      href="/integrations"
      cta="Go to Integrations"
    />
  );
}
