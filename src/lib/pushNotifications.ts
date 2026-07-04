/**
 * Native push notifications setup (Capacitor).
 * No-op when running on the web.
 */
export async function setupPushNotifications() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;

    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { supabase } = await import("@/integrations/supabase/client");

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== "granted") return;

    await PushNotifications.addListener("registration", async (token) => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        await supabase.from("push_tokens").upsert(
          {
            user_id: data.user.id,
            token: token.value,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,platform" }
        );
      } catch (e) {
        console.error("[Push] failed to save token:", e);
      }
    });

    await PushNotifications.addListener("registrationError", (err) => {
      console.error("[Push] registration error:", err);
    });

    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const url = action.notification?.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        window.location.href = url;
      }
    });

    await PushNotifications.register();
  } catch (e) {
    console.error("[Push] setup failed:", e);
  }
}
