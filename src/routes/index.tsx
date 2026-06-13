import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      navigate({ to: data.user ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-gold-primary text-sm tracking-[0.3em] uppercase animate-pulse">
        السيف
      </div>
    </div>
  );
}
