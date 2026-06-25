import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "app-backgrounds";
const SIGN_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 years

// Transparent 1x1 pixel to prevent fallback flicker while loading
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

let globalLogoUrl: string | null = null;
let globalCheckDone = false;

/**
 * Loads the current site logo URL from app_settings ('site_logo' key).
 * While loading, returns a transparent pixel to prevent flickering the fallback logo.
 * If no dynamic logo is set, returns null (allowing components to use fallback).
 * Update: Added a retry-trigger comment to help with build sandbox issues.
 */
export function useSiteLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(globalCheckDone ? globalLogoUrl : TRANSPARENT_PIXEL);
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

        if (!cancelled) {
          const finalUrl = signed?.signedUrl ?? null;
          globalLogoUrl = finalUrl;
          globalCheckDone = true;
          setLogoUrl(finalUrl);
        }
      } catch (err) {
        console.error("Error fetching site logo:", err);
        if (!cancelled) {
          globalCheckDone = true;
          setLogoUrl(null);
        }
      }
    };

    fetchLogo();

    // Use a unique name for each hook instance to prevent Realtime callback conflicts
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

  // Effect to re-fetch when version changes (realtime update)
  useEffect(() => {
    if (version === 0) return; // Skip initial as it's handled by the main effect

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
          globalLogoUrl = null;
          setLogoUrl(null);
        }
        return;
      }

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGN_SECONDS);

      if (!cancelled) {
        const finalUrl = signed?.signedUrl ?? null;
        globalLogoUrl = finalUrl;
        setLogoUrl(finalUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  return logoUrl;
}
