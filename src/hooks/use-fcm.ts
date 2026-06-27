import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FCM_VAPID_KEY } from "@/lib/fcm-config";

export function useFcm() {
  useEffect(() => {
    const win = window as any;

    const initPush = async () => {
      // 1. Native Platform (Capacitor)
      if (win.Capacitor?.isNativePlatform()) {
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
            console.log("Push registration success (Native), token:", token.value);
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) return;

            await (supabase as any).from("user_fcm_tokens").upsert({
              user_id: auth.user.id,
              token: token.value,
              device_type: win.Capacitor.getPlatform()
            }, { onConflict: "user_id, token" });
          });
        } catch (err) {
          console.error("Native FCM Initialization error:", err);
        }
      }
      // 2. Web Platform
      else if (typeof window !== "undefined" && "Notification" in window) {
        try {
          if (Notification.permission === "granted") {
             console.log("Web Notifications already granted.");
          }
        } catch (err) {
          console.warn("Web Push initialization skipped:", err);
        }
      }
    };

    initPush();
  }, []);
}
