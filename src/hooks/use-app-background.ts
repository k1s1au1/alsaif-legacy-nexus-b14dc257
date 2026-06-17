import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "app-backgrounds";
const SIGN_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 years

/**
 * Loads the current background image URL for a given setting key
 * (e.g. "auth_bg" or "dashboard_bg") from app_settings + storage.
 * Returns null when none is set.
 */
export function useAppBackground(settingKey: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", settingKey)
        .maybeSingle();
      const path = data?.value;
      if (!path) {
        if (!cancelled) setUrl(null);
        return;
      }
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGN_SECONDS);
      if (!cancelled) setUrl(signed?.signedUrl ?? null);
    })();

    // Listen for live updates
    const channel = supabase
      .channel(`app-settings-${settingKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: `key=eq.${settingKey}` },
        () => setVersion((v) => v + 1),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [settingKey, version]);

  return url;
}
