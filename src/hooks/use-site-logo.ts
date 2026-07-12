import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "app-backgrounds";
const SIGN_SECONDS = 60 * 60 * 24 * 365 * 5;

let globalLogoUrl: string | null = null;
let globalCheckDone = false;

/**
 * Optimized Logo Loader: Strictly fetches from DB or returns null.
 * Blacklists any legacy URLs to ensure the old logo NEVER appears.
 */
export function useSiteLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(globalLogoUrl);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchLogo = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "site_logo")
          .maybeSingle();

        const path = data?.value;
        if (!path) {
          if (!cancelled) {
            globalLogoUrl = null;
            globalCheckDone = true;
            setLogoUrl(null);
          }
          return;
        }

        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGN_SECONDS);

        const finalUrl = signed?.signedUrl ?? null;

        // Prevent showing the old logo if it's somehow still the one in storage
        if (finalUrl?.includes("alsaif-mark.png")) {
          if (!cancelled) {
            globalLogoUrl = null;
            setLogoUrl(null);
          }
          return;
        }

        if (!cancelled) {
          globalLogoUrl = finalUrl;
          globalCheckDone = true;
          setLogoUrl(finalUrl);
        }
      } catch (err) {
        console.error("Error fetching site logo:", err);
        if (!cancelled) {
          globalLogoUrl = null;
          setLogoUrl(null);
        }
      }
    };

    fetchLogo();

    const channelId = `logo-updates-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.site_logo" },
        () => setVersion((v) => v + 1),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [version]);

  return logoUrl;
}
