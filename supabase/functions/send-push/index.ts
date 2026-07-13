// Edge function: send-push
// Final optimized version for maximum reliability and clear error reporting.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function b64url(input: ArrayBuffer | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(sa: any) {
  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: iat + 3600,
    iat,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Firebase Auth Failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const { title, body, url, image, user_ids, exclude_user_id, data: customData } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SA_RAW = Deno.env.get("FCM_SERVICE_ACCOUNT");

    if (!SA_RAW) throw new Error("FCM_SERVICE_ACCOUNT secret is missing in Supabase Settings.");

    const sa = JSON.parse(SA_RAW.trim());
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch tokens
    const { data: rows, error: dbError } = await supabase
      .from("push_tokens")
      .select("token, user_id")
      .eq("is_active", true);

    if (dbError) throw new Error(`Database Error: ${dbError.message}`);

    const tokens = (rows || [])
      .filter((r: any) => {
        if (user_ids?.length && !user_ids.includes(r.user_id)) return false;
        return !(exclude_user_id && r.user_id === exclude_user_id);
      })
      .map((r: any) => r.token);

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, msg: "No active devices found." }), { headers: CORS_HEADERS });
    }

    const token = await getAccessToken(sa);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    let sent = 0;
    const fcmErrors: any[] = [];

    await Promise.all(tokens.map(async (fcmToken: string) => {
      const message = {
        message: {
          token: fcmToken,
          notification: { title, body, image },
          data: { url: url || "", ...customData },
          android: {
            priority: "high",
            notification: { channel_id: "alsaif_notifications", sound: "default", visibility: "PUBLIC" }
          },
          webpush: {
            notification: { title, body, icon: "/favicon.ico", image },
            fcm_options: { link: url || "/" }
          }
        }
      };

      const res = await fetch(fcmUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(message)
      });

      if (res.ok) sent++;
      else fcmErrors.push(await res.json());
    }));

    return new Response(JSON.stringify({ success: true, sent, total: tokens.length, errors: fcmErrors }), { headers: CORS_HEADERS });

  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 200, // Return 200 to bypass generic browser alerts
      headers: CORS_HEADERS
    });
  }
});
