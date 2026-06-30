import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

let initialized = false;

async function saveTokenToProfile(token: string): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      // Retry once auth state is ready
      const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED")) {
          await supabase.from("profiles").update({ fcm_token: token }).eq("id", session.user.id);
          sub.subscription.unsubscribe();
        }
      });
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ fcm_token: token })
      .eq("id", auth.user.id);
    if (error) console.error("[Push] Failed to save token:", error);
    else console.log("[Push] Token saved to user profile.");
  } catch (e) {
    console.error("[Push] saveTokenToProfile exception:", e);
  }
}

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

    await PushNotifications.addListener("registration", async (token: Token) => {
      console.log("[Push] Registration token:", token.value);
      await saveTokenToProfile(token.value);
    });

    await PushNotifications.addListener("registrationError", (err: unknown) => {
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
