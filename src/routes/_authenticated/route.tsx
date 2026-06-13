// Integration-managed protected layout.
// ssr:false because the Supabase session lives in localStorage (unreachable on the server).
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Force onboarding if the three-part name is missing
    if (location.pathname !== "/onboarding") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, father_name, grandfather_name")
        .eq("id", data.user.id)
        .maybeSingle();
      if (
        !profile?.first_name ||
        !profile?.father_name ||
        !profile?.grandfather_name
      ) {
        throw redirect({ to: "/onboarding" });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
