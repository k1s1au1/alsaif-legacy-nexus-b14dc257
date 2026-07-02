import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import alsaifMark from "@/assets/alsaif-mark.png.asset.json";

const BUCKET = "app-backgrounds";
const SIGN_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 years

let globalLogoUrl: string | null = null;
let globalCheckDone = false;

/**
 * Loads the current site logo URL from app_settings ('site_logo' key).
 * Returns the dynamic logo if set, or the default fallback if no custom logo exists.
 * Prevents the "flash" of the old logo by waiting for the check to complete.
 */
export function useSiteLogo() {
  // Start with the global cached URL if we have one
  const [logoUrl, setLogoUrl] = useState<string | null>(globalLogoUrl);
  const [isLoading, setIsLoading] = useState(!globalCheckDone);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchLogo = async () => {
      if (globalCheckDone && !version) return; // Already have it

      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "site_logo")
          .maybeSingle();

        const path = data?.value;
        if (!path) {
          if (!cancelled) {
            const final = alsaifMark.url;
            globalLogoUrl = final;
            globalCheckDone = true;
            setLogoUrl(final);
            setIsLoading(false);
          }
          return;
        }

        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGN_SECONDS);

        if (!cancelled) {
          const finalUrl = signed?.signedUrl ?? alsaifMark.url;
          globalLogoUrl = finalUrl;
          globalCheckDone = true;
          setLogoUrl(finalUrl);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error fetching site logo:", err);
        if (!cancelled) {
          globalLogoUrl = alsaifMark.url;
          globalCheckDone = true;
          setLogoUrl(alsaifMark.url);
          setIsLoading(false);
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
  }, []);

  useEffect(() => {
    if (version === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "site_logo")
        .maybeSingle();

      const path = data?.value;
      if (!path) {
        if (!cancelled) {
          globalLogoUrl = alsaifMark.url;
          setLogoUrl(alsaifMark.url);
        }
        return;
      }

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGN_SECONDS);

      if (!cancelled) {
        const finalUrl = signed?.signedUrl ?? alsaifMark.url;
        globalLogoUrl = finalUrl;
        setLogoUrl(finalUrl);
      }
    })();
    return () => { cancelled = true; };
  }, [version]);

  return logoUrl;
}
