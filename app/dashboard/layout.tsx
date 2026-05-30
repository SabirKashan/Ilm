import { Sidebar, BottomNav } from "@/components/dashboard/sidebar";
import { InstallPrompt } from "@/components/install-prompt";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Redirect teachers to their portal
  const { data: profile } = await supabase
    .from("users")
    .select("role, school_id")
    .eq("id", user.id)
    .single() as { data: { role: string; school_id: string } | null; error: unknown };

  if (profile?.role === "teacher") redirect("/teacher");

  // Redirect new admins to onboarding
  if (profile?.school_id) {
    const { data: school } = await supabase
      .from("schools")
      .select("onboarding_complete")
      .eq("id", profile.school_id)
      .single() as { data: { onboarding_complete: boolean } | null; error: unknown };

    if (school && !school.onboarding_complete) redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </div>
      </main>
      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
