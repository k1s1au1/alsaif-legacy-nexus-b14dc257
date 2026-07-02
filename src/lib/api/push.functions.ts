import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Notification type maps to a column in notification_preferences
export const NOTIFICATION_TYPES = ["meetings", "entertainment", "tasks", "chat", "news"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

async function getGoogleAccessToken(serviceAccount: any) {
  const iat = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: iat + 3600,
    iat,
  };
  const b64 = (o: any) =>
    btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claim)}`;
  const pem = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await (globalThis as any).crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await (globalThis as any).crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const b64sig = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = `${unsigned}.${b64sig}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data.access_token as string;
}

/**
 * Sends a push notification via FCM HTTP v1 to user devices.
 */
export const sendPushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { title: string; body: string; type?: string; target_user_ids?: string[]; route?: string }) =>
    z
      .object({
        title: z.string().min(1).max(150),
        body: z.string().min(1).max(300),
        type: z.enum(NOTIFICATION_TYPES).optional(),
        target_user_ids: z.array(z.string().uuid()).max(2000).optional(),
        route: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
      const supabaseAdmin = getSupabaseAdmin();
      if (!supabaseAdmin) throw new Error("Server not ready");

      const callerId = context.userId;

      // 1) Resolve target users
      let userIds: string[];
      if (data.target_user_ids && data.target_user_ids.length > 0) {
        userIds = data.target_user_ids.filter((id) => id !== callerId);
      } else {
        const { data: members } = await supabaseAdmin.from("profiles").select("id");
        userIds = (members ?? []).map((m: any) => m.id).filter((id) => id !== callerId);
      }
      if (userIds.length === 0) return { success: true, count: 0 };

      // 2) Filter by notification preferences (default ON when row missing)
      if (data.type) {
        const { data: prefs } = await supabaseAdmin
          .from("notification_preferences")
          .select("user_id," + data.type)
          .in("user_id", userIds);
        const optedOut = new Set(
          (prefs ?? [])
            .filter((p: any) => p[data.type!] === false)
            .map((p: any) => p.user_id),
        );
        userIds = userIds.filter((id) => !optedOut.has(id));
        if (userIds.length === 0) return { success: true, count: 0 };
      }

      // 3) Collect tokens from push_tokens + legacy profiles.fcm_token
      const tokens = new Set<string>();
      const { data: pushRows } = await supabaseAdmin
        .from("push_tokens")
        .select("token")
        .in("user_id", userIds)
        .eq("is_active", true);
      (pushRows ?? []).forEach((r: any) => r.token && tokens.add(r.token));

      const { data: profRows } = await supabaseAdmin
        .from("profiles")
        .select("fcm_token")
        .in("id", userIds)
        .not("fcm_token", "is", null);
      (profRows ?? []).forEach((r: any) => r.fcm_token && tokens.add(r.fcm_token));

      const tokenList = Array.from(tokens).filter((t) => t.length > 10);
      if (tokenList.length === 0) return { success: true, count: 0 };

      // 4) Send via FCM v1
      const saRaw = process.env.FCM_SERVICE_ACCOUNT;
      if (!saRaw) throw new Error("FCM not configured");
      const sa = JSON.parse(saRaw);
      const accessToken = await getGoogleAccessToken(sa);

      const dataPayload: Record<string, string> = {};
      if (data.route) dataPayload.route = data.route;
      if (data.type) dataPayload.type = data.type as string;

      const results = await Promise.all(
        tokenList.map(async (token) => {
          try {
            const r = await fetch(
              `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  message: {
                    token,
                    notification: { title: data.title, body: data.body },
                    data: dataPayload,
                    webpush: data.route
                      ? { fcm_options: { link: data.route } }
                      : undefined,
                  },
                }),
              },
            );
            if (!r.ok) {
              // Deactivate dead tokens
              if (r.status === 404 || r.status === 400) {
                await supabaseAdmin
                  .from("push_tokens")
                  .update({ is_active: false })
                  .eq("token", token);
              }
              return false;
            }
            return true;
          } catch {
            return false;
          }
        }),
      );
      return { success: true, count: results.filter(Boolean).length };
    } catch (e: any) {
      console.error("sendPushNotification error", e);
      return { success: false, error: "تعذّر إرسال الإشعار" };
    }
  });
