import { EmptyState } from "@/components/empty-state";

export default async function LeadDetailPage({ params }: PageProps<"/leads/[id]">) {
  await params;
  return <EmptyState title="Lead" body="Lead details will appear here." href="/leads" cta="Back to leads" />;
}
