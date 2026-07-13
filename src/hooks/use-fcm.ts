import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { setupPushNotifications } from "@/lib/pushNotifications";
import { Capacitor } from "@capacitor/core";

/**
 * Hook to initialize push notifications and handle registration.
 * delegates actual setup to lib/pushNotifications.ts
 */
export function useFcm() {
  const navigate = useNavigate();

  useEffect(() => {
    // Only initialize on native platforms
    if (Capacitor.isNativePlatform()) {
      setupPushNotifications(navigate).catch(err => {
        console.error("[FCM Hook] Failed to setup notifications:", err);
      });
    }
  }, [navigate]);
}
