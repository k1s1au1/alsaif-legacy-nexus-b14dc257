import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { samplePaletteFromUrl, type BgPalette } from "@/lib/bg-palette";

const BUCKET = "app-backgrounds";
const SIGN_SECONDS = 60 * 60 * 24 * 365 * 5; // 5 years

/**
 * Loads the current background image URL for a given setting key
 * (e.g. "auth_bg" or "dashboard_bg") from app_settings + storage,
 * and derives a UI palette from that image so text/cards adapt
 * automatically to the new background.
 */
export function useAppBackground(settingKey: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [palette, setPalette] = useState<BgPalette | null>(null);
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
        if (!cancelled) {
          setUrl(null);
          setPalette(null);
        }
        return;
      }
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGN_SECONDS);
      const signedUrl = signed?.signedUrl ?? null;
      if (!cancelled) setUrl(signedUrl);
      if (signedUrl) {
        const p = await samplePaletteFromUrl(signedUrl);
        if (!cancelled) setPalette(p);
      }
    })();

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

  return { url, palette };
}
