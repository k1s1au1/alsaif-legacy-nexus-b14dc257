import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { setupPushNotifications } from "@/lib/pushNotifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { FCM_VAPID_KEY, FIREBASE_CONFIG } from "@/lib/fcm-config";
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

/**
 * Hook to initialize push notifications for both Web and Mobile.
 */
export function useFcm() {
  const navigate = useNavigate();

  useEffect(() => {
    const initPush = async () => {
      // 1. Native Platform (Mobile App)
      if (Capacitor.isNativePlatform()) {
        try {
          await setupPushNotifications(navigate);
        } catch (err) {
          console.error("[Push] Native setup failed:", err);
        }
      }
      // 2. Web Platform (Browser)
      else if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          if (!(await isSupported())) return;

          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;

          const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
            scope: "/",
          });
          await navigator.serviceWorker.ready;

          const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
          const messaging = getMessaging(app);

          const token = await getToken(messaging, {
            vapidKey: FCM_VAPID_KEY,
            serviceWorkerRegistration: registration,
          });

          if (token) {
            const { data: auth } = await supabase.auth.getUser();
            if (auth.user) {
              await supabase.from("push_tokens").upsert(
                {
                  user_id: auth.user.id,
                  token,
                  platform: "web",
                  is_active: true,
                },
                { onConflict: "token" }
              );
            }
          }
        } catch (err) {
          console.warn("[Push] Web initialization failed:", err);
        }
      }
    };

    void initPush();
  }, [navigate]);
}
