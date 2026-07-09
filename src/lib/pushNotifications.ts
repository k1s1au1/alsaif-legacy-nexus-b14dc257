import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sets up native push notifications (Android/iOS via Capacitor).
 * No-op when running on the web.
 */
export async function setupPushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    console.log("[Push] Not a native platform, skipping setup.");
    return;
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    console.log("[Push] Checking permissions...");
    let perm = await PushNotifications.checkPermissions();

    if (perm.receive === "prompt" || perm.receive === "denied") {
      console.log("[Push] Requesting permissions...");
      perm = await PushNotifications.requestPermissions();
    }

    if (perm.receive !== "granted") {
      console.warn("[Push] Permission not granted:", perm.receive);
      return;
    }

    console.log("[Push] Registering with FCM...");
    await PushNotifications.register();

    // Listen for registration (getting the token)
    await PushNotifications.addListener("registration", async (token) => {
      console.log("[Push] Registration successful, token:", token.value);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        console.warn("[Push] No user logged in, cannot save token.");
        return;
      }

      const { error } = await supabase.from("push_tokens").upsert(
        {
          user_id: auth.user.id,
          token: token.value,
          platform: Capacitor.getPlatform(),
          is_active: true,
        },
        { onConflict: "token" },
      );

      if (error) console.error("[Push] Error saving token to Supabase:", error);
      else console.log("[Push] Token saved successfully.");
    });

    await PushNotifications.addListener("registrationError", (err) => {
      console.error("[Push] registration error:", err);
    });

    await PushNotifications.register();
  } catch (e) {
    console.error("[Push] setup failed:", e);
  }
}
