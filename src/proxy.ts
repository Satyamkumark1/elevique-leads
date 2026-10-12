import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/public-env";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

/** Refreshes the Supabase session and gates every page on the team allowlist (FR-28). */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const redirect = (to: string) => {
    const r = NextResponse.redirect(new URL(to, request.url));
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!user) return PUBLIC_PATHS.includes(path) || path === "/not-authorised" ? response : redirect("/login");

  const { data: isTeam } = await supabase.rpc("is_team_member");
  if (!isTeam) return path === "/not-authorised" ? response : redirect("/not-authorised");
  if (path === "/login" || path === "/not-authorised") return redirect("/");
  return response;
}

export const config = {
  // API routes authorise themselves (signatures, CRON_SECRET, or session checks in the handler).
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
