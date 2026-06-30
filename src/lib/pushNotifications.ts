import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

let initialized = false;

function detectPlatform(): "android" | "ios" | "web" {
  try {
    const p = Capacitor.getPlatform();
    if (p === "android" || p === "ios") return p;
  } catch {}
  return "web";
}

async function saveToken(tokenValue: string) {
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
}

function navigateTo(route?: string) {
  if (!route || typeof window === "undefined") return;
  // Normalize to a path; use full reload so the route is resolved by TanStack on next mount.
  try {
    const u = new URL(route, window.location.origin);
    window.location.assign(u.pathname + u.search + u.hash);
  } catch {
    window.location.assign(route);
  }
}

export async function setupPushNotifications(): Promise<void> {
  if (typeof window === "undefined") return;
  if (initialized) return;
  initialized = true;

  if (!Capacitor.isNativePlatform()) return; // web path is handled by useFcm hook
  const platform = detectPlatform();

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      console.warn("[Push] permission not granted:", perm.receive);
      return;
    }

    await PushNotifications.register();

    await PushNotifications.addListener("registration", async (token: Token) => {
      console.log("[Push] token obtained");
      await saveToken(token.value);
    });

    await PushNotifications.addListener("registrationError", (err: unknown) => {
      console.error("[Push] registration error:", err);
    });

    await PushNotifications.addListener(
      "pushNotificationReceived",
      (n: PushNotificationSchema) => {
        console.log("[Push] received:", n.title);
      },
    );

    await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action: ActionPerformed) => {
        const route =
          (action.notification?.data as any)?.route ||
          (action.notification as any)?.click_action;
        navigateTo(route);
      },
    );
  } catch (e) {
    console.error("[Push] setup failed", e);
  }
}
