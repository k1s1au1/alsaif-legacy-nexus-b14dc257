import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "app-backgrounds";
const SIGN_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 years

/**
 * Loads the current background image URL for a given setting key
 * (e.g. "auth_bg" or "dashboard_bg") from app_settings + storage.
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

      // Use Public URL instead of Signed URL so it works on login page
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path);

      if (!cancelled) setUrl(publicUrl);
    })();

    const channelId = `app-settings-${settingKey}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
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

  return { url };
}
