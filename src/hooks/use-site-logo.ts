import { useEffect, useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "app-backgrounds";
const SIGN_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 years

/**
 * Loads the current site logo URL from app_settings ('site_logo' key).
 * If no dynamic logo is set, returns null (caller should fallback to static asset).
 */
export function useSiteLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const instanceId = useId();

  // Fetch logo whenever version changes
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "site_logo")
        .maybeSingle();

      const path = data?.value;
      if (!path) {
        if (!cancelled) setLogoUrl(null);
        return;
      }

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGN_SECONDS);

      if (!cancelled) setLogoUrl(signed?.signedUrl ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [version]);

  // Subscribe once per hook instance with a unique channel name
  useEffect(() => {
    const channel = supabase
      .channel(`app-settings-site-logo-${instanceId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.site_logo" },
        () => setVersion((v) => v + 1),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  return logoUrl;
}
