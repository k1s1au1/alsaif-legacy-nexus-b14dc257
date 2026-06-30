import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FCM_VAPID_KEY, FIREBASE_CONFIG } from "@/lib/fcm-config";
import { toast } from "sonner";

export function useFcm() {
  useEffect(() => {
    const win = window as any;

    const saveToken = async (tokenValue: string) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          console.log("No authenticated user, push token not saved");
          return;
        }

        const { error } = await supabase
          .from("push_tokens")
          .upsert({
            user_id: user.id,
            token: tokenValue,
            platform: 'android',
            is_active: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'token' });

        if (error) {
          console.log("Save push token error:", error);
        } else {
          console.log("Push token saved successfully");
        }
      } catch (e) {
        console.log("Save push token error:", e);
      }
    };

    const initPush = async () => {
      // 1. Native Platform (Mobile App)
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
            await saveToken(token.value);
          });

          PushNotifications.addListener("registrationError", (err: any) => {
            console.error("Push registration error:", err);
          });
        } catch (err) {
          console.error("Native FCM Initialization error:", err);
        }
      }
      // 2. Web Platform (Browser) - use Firebase JS SDK getToken
      else if (typeof window !== "undefined" && "serviceWorker" in navigator && "Notification" in window) {
        try {
          const { isSupported, getMessaging, getToken } = await import("firebase/messaging");
          const { initializeApp, getApps } = await import("firebase/app");

          if (!(await isSupported())) {
            console.warn("FCM not supported in this browser");
            return;
          }

          if (Notification.permission === "default") {
            await Notification.requestPermission();
          }
          if (Notification.permission !== "granted") return;

          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
          await navigator.serviceWorker.ready;

          const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
          const messaging = getMessaging(app);

          const token = await getToken(messaging, {
            vapidKey: FCM_VAPID_KEY,
            serviceWorkerRegistration: registration,
          });

          if (token) {
            console.log("FCM Web Token obtained");
            await saveToken(token);
          } else {
            console.warn("No FCM token returned");
          }
        } catch (err: any) {
          console.warn("Web FCM initialization failed:", err?.code, err?.message, err);
          // Silent fail — don't show toast on every page load. User can re-enable from settings.
        }

      }
    };

    initPush();
  }, []);
}
