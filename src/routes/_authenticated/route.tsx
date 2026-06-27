import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TermsGate } from "@/components/terms-gate";
import { AlertCircle, Home, RefreshCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="card-surface max-w-md w-full p-10 text-center space-y-6 shadow-2xl border-rose-500/20">
         <div className="size-20 rounded-[32px] bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto">
            <AlertCircle size={40} />
         </div>
         <div className="space-y-2">
            <h2 className="text-2xl font-black text-primary tracking-tight">حدث خطأ في النظام</h2>
            <p className="text-sm font-bold text-muted-foreground opacity-60 leading-relaxed">أعتذر منك، يبدو أن هناك مشكلة في تحميل البيانات. يمكنك المحاولة مرة أخرى أو العودة للرئيسية.</p>
         </div>
         <div className="p-4 rounded-2xl bg-muted/50 text-[10px] font-mono text-muted-foreground break-all text-left overflow-hidden max-h-32 overflow-y-auto">
            {error.message}
         </div>
         <div className="flex gap-3">
            <button onClick={() => reset()} className="flex-1 h-14 rounded-2xl bg-primary text-white font-black text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all">
               <RefreshCcw size={18} /> إعادة المحاولة
            </button>
            <a href="/" className="size-14 rounded-2xl bg-muted flex items-center justify-center text-primary hover:bg-border transition-all">
               <Home size={20} />
            </a>
         </div>
      </div>
    </div>
  ),
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
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { location } = useRouterState();

  return (
    <TermsGate>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 15, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.99 }}
          transition={{
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1], // Smooth exponential ease
          }}
          className="w-full h-full"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </TermsGate>
  );
}

