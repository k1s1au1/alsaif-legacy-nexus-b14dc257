import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

let initialized = false;
let authListenerBound = false;
const PENDING_KEY = "pending_fcm_token";

function detectPlatform(): "android" | "ios" | "web" {
  try {
    const p = Capacitor.getPlatform();
    if (p === "android" || p === "ios") return p;
  } catch {}
  return "web";
}

export async function savePushTokenToSupabase(token: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      try { localStorage.setItem(PENDING_KEY, token); } catch {}
      console.log("[Push] No authenticated user, token saved locally");
      return;
    }

    const platform = detectPlatform();
    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        {
          user_id: user.id,
          token,
          platform: platform === "web" ? "android" : platform,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );

    if (error) {
      console.error("[Push] save token error", error);
      try { localStorage.setItem(PENDING_KEY, token); } catch {}
      return;
    }

    console.log("[Push] token saved successfully");
    try { localStorage.removeItem(PENDING_KEY); } catch {}
    // Back-compat single-token mirror
    try {
      await supabase.from("profiles").update({ fcm_token: token }).eq("id", user.id);
    } catch (e) {
      console.warn("[Push] profile mirror failed", e);
    }
  } catch (e) {
    console.error("[Push] save token error", e);
    try { localStorage.setItem(PENDING_KEY, token); } catch {}
  }
}

function bindAuthListener() {
  if (authListenerBound) return;
  authListenerBound = true;
  supabase.auth.onAuthStateChange(async (event) => {
    if (event !== "SIGNED_IN" && event !== "TOKEN_REFRESHED") return;
    let pending: string | null = null;
    try { pending = localStorage.getItem(PENDING_KEY); } catch {}
    if (pending) await savePushTokenToSupabase(pending);
  });
}

function navigateTo(route?: string) {
  if (!route || typeof window === "undefined") return;
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

  bindAuthListener();

  // On startup, try flushing any pending token if user is already signed in.
  try {
    const pending = localStorage.getItem(PENDING_KEY);
    if (pending) await savePushTokenToSupabase(pending);
  } catch {}

  if (!Capacitor.isNativePlatform()) return; // web path handled by useFcm hook

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      console.warn("[Push] permission not granted:", perm.receive);
      return;
    }

    await PushNotifications.register();

    await PushNotifications.addListener("registration", async (token: Token) => {
      console.log("[Push] token received");
      try { localStorage.setItem(PENDING_KEY, token.value); } catch {}
      await savePushTokenToSupabase(token.value);
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
