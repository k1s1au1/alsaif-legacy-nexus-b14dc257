import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { setupPushNotifications, syncTokenWithSupabase } from "@/lib/pushNotifications";
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
    // 1. Initial Setup
    const initPush = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await setupPushNotifications(navigate);
        } catch (err) {
          console.error("[Push] Native setup failed:", err);
        }
      } else if (typeof window !== "undefined" && "serviceWorker" in navigator) {
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
            localStorage.setItem("fcm_token", token);
            await syncTokenWithSupabase(token);
          }
        } catch (err) {
          console.warn("[Push] Web initialization failed:", err);
        }
      }
    };

    void initPush();

    // 2. Auth State Listener for Token Sync
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        const storedToken = localStorage.getItem("fcm_token");
        if (storedToken) {
          console.log("[Push] User logged in, syncing stored token...");
          await syncTokenWithSupabase(storedToken);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);
}
