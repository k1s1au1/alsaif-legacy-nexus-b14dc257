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

async function saveToken(token: string, platform: "android" | "ios" | "web") {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      // Retry on next sign-in
      const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
          await saveToken(token, platform);
          sub.subscription.unsubscribe();
        }
      });
      return;
    }
    // Multi-device store (UNIQUE on user_id + token → upsert is idempotent)
    await supabase
      .from("push_tokens")
      .upsert(
        { user_id: userId, token, platform, is_active: true, updated_at: new Date().toISOString() },
        { onConflict: "user_id,token" },
      );
    // Legacy single-token mirror (kept for back-compat with existing senders)
    await supabase.from("profiles").update({ fcm_token: token }).eq("id", userId);
  } catch (e) {
    console.error("[Push] saveToken failed", e);
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
      console.log("[Push] token:", token.value.slice(0, 16) + "…");
      await saveToken(token.value, platform === "web" ? "android" : platform);
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
