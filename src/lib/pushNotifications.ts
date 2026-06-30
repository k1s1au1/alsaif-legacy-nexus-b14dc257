import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from "@capacitor/push-notifications";

let initialized = false;

export async function setupPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (initialized) return;
  initialized = true;

  try {
    let perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      console.warn("[Push] Permission not granted:", perm.receive);
      return;
    }

    await PushNotifications.register();

    await PushNotifications.addListener("registration", (token: Token) => {
      console.log("[Push] Registration token:", token.value);
    });

    await PushNotifications.addListener("registrationError", (err) => {
      console.error("[Push] Registration error:", err);
    });

    await PushNotifications.addListener(
      "pushNotificationReceived",
      (notification: PushNotificationSchema) => {
        console.log("[Push] Notification received:", notification);
      },
    );

    await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action: ActionPerformed) => {
        console.log("[Push] Notification action performed:", action);
      },
    );
  } catch (e) {
    console.error("[Push] setup failed:", e);
  }
}
