import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/toaster";
import { TopBar } from "@/components/top-bar";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login"); // proxy already gates; this is the server-side check

  const { data: lastWebhook } = await supabase
    .from("events")
    .select("created_at")
    .like("type", "webhook.%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar email={user.email ?? ""} lastWebhookAt={lastWebhook?.created_at ?? null} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 pb-24 md:p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
