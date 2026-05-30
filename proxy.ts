import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const publicRoutes = ["/auth/login", "/auth/verify"];
  const isPublic =
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/pay/") ||
    pathname.startsWith("/print/");

  if (isPublic) {
    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role === "teacher") {
        return NextResponse.redirect(new URL("/teacher", request.url));
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // API routes are handled by the app itself — no auth redirect
  if (pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding")) {
    const { data: profile } = await supabase
      .from("users")
      .select("role, school_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.redirect(new URL("/teacher", request.url));
    }

    if (pathname.startsWith("/dashboard")) {
      const { data: school } = await supabase
        .from("schools")
        .select("onboarding_complete")
        .eq("id", profile.school_id)
        .single();

      if (school && !school.onboarding_complete) {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
    }
  }

  if (pathname.startsWith("/teacher")) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "teacher") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
