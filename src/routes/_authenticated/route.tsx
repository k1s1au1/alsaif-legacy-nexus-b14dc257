// Integration-managed protected layout.
// ssr:false because the Supabase session lives in localStorage (unreachable on the server).
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TermsGate } from "@/components/terms-gate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });

      // Force onboarding if the three-part name is missing
      if (location.pathname !== "/onboarding") {
        const { data: profile, error: pError } = await supabase
          .from("profiles")
          .select("first_name, father_name, grandfather_name")
          .eq("id", data.user.id)
          .maybeSingle();

        // If we can't check profile (e.g. columns missing), don't block the app
        if (!pError && profile) {
          if (
            !profile.first_name ||
            !profile.father_name ||
            !profile.grandfather_name
          ) {
            throw redirect({ to: "/onboarding" });
          }
        }
      }

      return { user: data.user };
    } catch (e) {
      // Re-throw redirects so the router handles them
      if (typeof e === 'object' && e !== null && ('to' in e || 'status' in e)) {
        throw e;
      }
      console.error("Auth guard error:", e);
      // Fallback: allow access if we have a user at least
      const { data } = await supabase.auth.getUser();
      if (data?.user) return { user: data.user };
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <TermsGate>
      <Outlet />
    </TermsGate>
  ),
});

