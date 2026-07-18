import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Hook to request essential permissions at app startup.
 * Android will show the dialog for each requested permission if not already granted.
 */
export function useAppPermissions() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const requestAllPermissions = async () => {
      try {
        // 1. Camera & Photos
        const { Camera } = await import("@capacitor/camera");
        const cameraStatus = await Camera.checkPermissions();
        if (cameraStatus.camera !== 'granted' || cameraStatus.photos !== 'granted') {
          await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
        }

        // 2. Geolocation
        const { Geolocation } = await import("@capacitor/geolocation");
        const geoStatus = await Geolocation.checkPermissions();
        if (geoStatus.location !== 'granted') {
          await Geolocation.requestPermissions({ permissions: ['location'] });
        }

        // 3. Notifications (Usually handled by useFcm, but we can ensure it here)
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const pushStatus = await PushNotifications.checkPermissions();
        if (pushStatus.receive !== 'granted') {
          await PushNotifications.requestPermissions();
        }

        console.log("[Permissions] Essential permissions requested/checked.");
      } catch (error) {
        console.error("[Permissions] Error requesting permissions:", error);
      }
    };

    // We can delay it slightly to let the UI settle
    const timer = setTimeout(() => {
      void requestAllPermissions();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);
}
