import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FCM_VAPID_KEY } from "@/lib/fcm-config";

export function useFcm() {
  useEffect(() => {
    const win = window as any;

    const saveToken = async (token: string, type: string) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      console.log(`Saving ${type} token to DB...`);
      await (supabase as any).from("user_fcm_tokens").upsert({
        user_id: auth.user.id,
        token: token,
        device_type: type
      }, { onConflict: "user_id, token" });
    };

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
            await saveToken(token.value, win.Capacitor.getPlatform());
          });
        } catch (err) {
          console.error("Native FCM Initialization error:", err);
        }
      }
      // 2. Web Platform (Browser)
      else if (typeof window !== "undefined" && "serviceWorker" in navigator && "Notification" in window) {
        try {
          if (Notification.permission === "default") {
            await Notification.requestPermission();
          }

          if (Notification.permission === "granted") {
            // Note: In browser environments, tokens are handled via service worker
            // Registration is usually handled by Firebase JS SDK or manual worker.
            console.log("Web Push: Permission granted. Ready for registration.");
          }
        } catch (err) {
          console.warn("Web Push initialization skipped:", err);
        }
      }
    };

    initPush();
  }, []);
}
