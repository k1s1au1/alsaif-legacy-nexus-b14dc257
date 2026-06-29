import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function getGoogleAccessToken(serviceAccount: any) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat,
  };

  const b64Header = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const b64Claim = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedJwt = `${b64Header}.${b64Claim}`;

  const pemContents = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedJwt)
  );

  const b64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedJwt}.${b64Signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await response.json();
  if (data.error) throw new Error(`OAuth Error: ${data.error_description || data.error}`);
  return data.access_token;
}

/**
 * Sends a push notification using Firebase Cloud Messaging HTTP v1 API.
 * Requires FCM_SERVICE_ACCOUNT (JSON string) in environment variables.
 *
 * Auth: requires an authenticated caller. Only admins, chairman, or
 * section managers may dispatch broadcasts.
 */
export const sendFcmNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      title: z.string().min(1).max(120),
      body: z.string().min(1).max(300),
      roles: z.array(z.string().max(40)).max(10).optional(),
      data: z.record(z.string().max(500)).optional()
    }).parse(data)
  )
  .handler(async ({ data: { title, body, roles, data: customData }, context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Authorize: caller must be admin / chairman / manager
      const { data: callerRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const callerRoleSet = new Set((callerRoles ?? []).map((r: any) => r.role));
      const allowed =
        callerRoleSet.has("admin") ||
        callerRoleSet.has("chairman") ||
        callerRoleSet.has("manager");
      if (!allowed) {
        return { success: false, error: "غير مصرح بإرسال الإشعارات" };
      }

      // 1. Fetch target user IDs if roles provided
      let targetUserIds: string[] | null = null;
      if (roles && roles.length > 0) {
        const { data: userRoles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .in("role", roles as any);
        targetUserIds = (userRoles ?? []).map((r: any) => r.user_id);
        if (targetUserIds.length === 0) return { success: true, count: 0 };
      }

      // 2. Fetch tokens from profiles table
      let query = supabaseAdmin.from("profiles").select("fcm_token").not("fcm_token", "is", null);
      if (targetUserIds) {
        query = query.in("id", targetUserIds);
      }

      const { data: profiles, error: fetchErr } = await query;
      if (fetchErr) throw new Error(`Database error: ${fetchErr.message}`);

      const registration_ids = (profiles as Array<{ fcm_token: string }>)
        ?.map(p => p.fcm_token)
        .filter(t => t && t.length > 10);

      if (!registration_ids || registration_ids.length === 0) {
        return { success: false, error: "لا يوجد أجهزة مسجلة حالياً." };
      }

      // 2. Load Service Account
      const serviceAccountRaw = process.env.FCM_SERVICE_ACCOUNT;
      if (!serviceAccountRaw) throw new Error("FCM Configuration missing");

      const sa = JSON.parse(serviceAccountRaw);
      const accessToken = await getGoogleAccessToken(sa);

      console.log(`FCM V1: Sending to ${registration_ids.length} devices...`);

      const results = await Promise.all(registration_ids.map(async (token) => {
        try {
          const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                data: customData
              }
            })
          });
          return res.ok;
        } catch (e) {
          return false;
        }
      }));

      const successCount = results.filter(Boolean).length;
      return { success: true, count: successCount };
    } catch (error: any) {
      console.error("FCM Send Error:", error);
      return { success: false, error: "تعذر إرسال الإشعار" };
    }
  });
