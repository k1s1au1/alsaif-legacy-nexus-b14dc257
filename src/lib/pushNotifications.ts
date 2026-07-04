import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sets up native push notifications (Android/iOS via Capacitor).
 * No-op when running on the web.
 */
export async function setupPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;

    await PushNotifications.addListener("registration", async (token) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      await supabase.from("push_tokens").upsert(
        {
          user_id: auth.user.id,
          token: token.value,
          platform: Capacitor.getPlatform(),
          is_active: true,
        },
        { onConflict: "token" },
      );
    });

    await PushNotifications.addListener("registrationError", (err) => {
      console.error("[Push] registration error:", err);
    });

    await PushNotifications.register();
  } catch (e) {
    console.error("[Push] setup failed:", e);
  }
}
