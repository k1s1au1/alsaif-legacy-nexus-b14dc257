import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useFcm() {
  useEffect(() => {
    // Only run on native platforms or if Capacitor is available
    const win = window as any;
    if (!win.Capacitor?.isNativePlatform()) return;

    const initPush = async () => {
      try {
        const { PushNotifications } = win.Capacitor.Plugins;
        if (!PushNotifications) return;

        let perm = await PushNotifications.checkPermissions();
        if (perm.receive !== "granted") {
          perm = await PushNotifications.requestPermissions();
        }

        if (perm.receive !== "granted") return;

        await PushNotifications.register();

        PushNotifications.addListener("registration", async (token: { value: string }) => {
          console.log("Push registration success, token:", token.value);
          const { data: auth } = await supabase.auth.getUser();
          if (!auth.user) return;

          // Save token to DB
          await (supabase as any).from("user_fcm_tokens").upsert({
            user_id: auth.user.id,
            token: token.value,
            device_type: win.Capacitor.getPlatform()
          }, { onConflict: "user_id, token" });
        });

        PushNotifications.addListener("registrationError", (error: any) => {
          console.error("Push registration error:", error);
        });

        PushNotifications.addListener("pushNotificationReceived", (notification: any) => {
          console.log("Push received:", notification);
        });

      } catch (err) {
        console.error("FCM Initialization error:", err);
      }
    };

    initPush();
  }, []);
}
