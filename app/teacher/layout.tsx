import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { TeacherNav } from "./teacher-nav";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, name, school_id")
    .eq("id", user.id)
    .single() as { data: { role: string; name: string; school_id: string } | null; error: unknown };

  // Admins should be in /dashboard, not /teacher
  if (!profile) redirect("/auth/login");
  if (profile.role === "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <TeacherNav teacherName={profile.name} />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {children}
      </main>
    </div>
  );
}
