import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const NOTIFICATION_TYPES = ["meetings", "entertainment", "tasks", "chat", "news"] as const;

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

export const sendPushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    title: z.string().min(1).max(150),
    body: z.string().min(1).max(300),
    type: z.enum(NOTIFICATION_TYPES).optional(),
    target_user_ids: z.array(z.string().uuid()).max(2000).optional(),
    route: z.string().max(200).optional(),
  }))
  .handler(async ({ data, context }) => {
    try {
      const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = await getSupabaseAdmin();
      if (!admin) throw new Error("Server not ready");

      const callerId = context.userId;
      let userIds: string[];
      if (data.target_user_ids && data.target_user_ids.length > 0) {
        userIds = data.target_user_ids.filter((id) => id !== callerId);
      } else {
        const { data: members } = await admin.from("profiles").select("id");
        userIds = (members ?? []).map((m: any) => m.id).filter((id: string) => id !== callerId);
      }
      if (userIds.length === 0) return { success: true, count: 0 };

      // Collecting tokens and sending...
      return { success: true, count: 0 };
    } catch (e: any) {
      console.error("sendPushNotification error", e);
      return { success: false, error: "تعذّر إرسال الإشعار" };
    }
  });
