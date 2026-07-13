// Edge function: send-push
// Sends FCM v1 push notifications using the provided Service Account JSON.
// This version is ultra-robust to handle any secret formatting issues.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64url(input: ArrayBuffer | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(sa: any): Promise<string> {
  try {
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
    const sig = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    );
    const jwt = `${unsigned}.${b64url(sig)}`;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();
    if (!data.access_token) {
      throw new Error(`Firebase token fetch failed: ${JSON.stringify(data)}`);
    }
    return data.access_token;
  } catch (e: any) {
    throw new Error(`Auth logic error: ${e.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const payload = await req.json();
    const { title, body, url, image, user_ids, exclude_user_id, category, data: customData } = payload;

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body are required" }), { status: 400, headers: CORS });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SA_RAW = Deno.env.get("FCM_SERVICE_ACCOUNT");

    if (!SA_RAW) {
      return new Response(JSON.stringify({ success: false, error: "FCM_SERVICE_ACCOUNT secret is missing in Supabase." }), { status: 200, headers: CORS });
    }

    let sa;
    try {
      sa = JSON.parse(SA_RAW.trim());
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: `Invalid JSON in FCM_SERVICE_ACCOUNT: ${e.message}` }), { status: 200, headers: CORS });
    }

    // Initialize Supabase Client
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch tokens
    const { data: rows, error: dbError } = await supabase
      .from("push_tokens")
      .select("token, user_id")
      .eq("is_active", true);

    if (dbError) {
      return new Response(JSON.stringify({ success: false, error: `Database error: ${dbError.message}` }), { status: 200, headers: CORS });
    }

    const tokens = (rows || [])
      .filter((r: any) => {
        if (user_ids?.length && !user_ids.includes(r.user_id)) return false;
        if (exclude_user_id && r.user_id === exclude_user_id) return false;
        return true;
      })
      .map((r: any) => r.token);

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No active devices found to notify." }), { status: 200, headers: CORS });
    }

    const accessToken = await getAccessToken(sa);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    let sentCount = 0;
    const errors: any[] = [];

    await Promise.all(tokens.map(async (token: string) => {
      const message = {
        message: {
          token,
          notification: { title, body, image },
          data: { url: url || "", ...customData },
          android: {
            priority: "high",
            notification: {
              channel_id: "alsaif_notifications",
              sound: "default",
              notification_priority: "PRIORITY_MAX",
              visibility: "PUBLIC"
            }
          },
          webpush: {
            headers: { image: image || "" },
            notification: {
              title,
              body,
              icon: "/favicon.ico",
              image: image || "",
            },
            fcm_options: { link: url || "/" },
          },
        }
      };

      const res = await fetch(fcmUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(message)
      });

      if (res.ok) sentCount++;
      else {
        const err = await res.json();
        errors.push(err);
        if (res.status === 404 || JSON.stringify(err).includes("UNREGISTERED")) {
           await supabase.from("push_tokens").update({ is_active: false }).eq("token", token);
        }
      }
    }));

    return new Response(JSON.stringify({ success: true, sent: sentCount, total: tokens.length, fcm_errors: errors }), { status: 200, headers: CORS });

  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: `Critical System Error: ${e.message}` }), { status: 200, headers: CORS });
  }
});
