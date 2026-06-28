import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// --- Helpers (Web Crypto API, runs in Cloudflare Workers) ---

function base64UrlEncode(buf: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof buf === "string") {
    bytes = new TextEncoder().encode(buf);
  } else if (buf instanceof Uint8Array) {
    bytes = buf;
  } else {
    bytes = new Uint8Array(buf);
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getGoogleAccessToken(sa: {
  client_email: string;
  private_key: string;
  token_uri: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(claim),
  )}`;

  const keyData = pemToArrayBuffer(sa.private_key);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64UrlEncode(sig)}`;

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    )}&assertion=${jwt}`,
  });
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Google token error: ${json.error || res.status} ${json.error_description || ""}`,
    );
  }
  return json.access_token;
}

// --- Server Function ---

export const sendFcmNotification = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        title: z.string(),
        body: z.string(),
        data: z.record(z.string()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data: { title, body, data: customData } }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch all FCM tokens (bypass RLS via admin)
    const { data: profiles, error: fetchErr } = await (supabaseAdmin as any)
      .from("profiles")
      .select("fcm_token");

    if (fetchErr) {
      console.error("FCM: Error fetching profiles:", fetchErr);
      return { success: false, error: "Database error" };
    }

    const tokens = (profiles as Array<{ fcm_token: string | null }>)
      ?.map((p) => p.fcm_token)
      .filter((t): t is string => !!t && t.length > 10);

    if (!tokens || tokens.length === 0) {
      return {
        success: false,
        error: "لم يتم العثور على أجهزة مسجلة بعد. يرجى تحديث صفحة الإدارة والمحاولة مرة أخرى.",
      };
    }

    // 2. Load service account
    const saRaw = process.env.FCM_SERVICE_ACCOUNT;
    if (!saRaw) {
      return { success: false, error: "FCM service account not configured." };
    }

    let sa: { project_id: string; client_email: string; private_key: string; token_uri: string };
    try {
      sa = JSON.parse(saRaw);
    } catch (e) {
      console.error("FCM: Invalid service account JSON:", e);
      return { success: false, error: "Invalid service account JSON." };
    }

    // 3. Mint Google OAuth access token (1h validity)
    let accessToken: string;
    try {
      accessToken = await getGoogleAccessToken(sa);
    } catch (e: any) {
      console.error("FCM: Failed to mint Google access token:", e);
      return { success: false, error: e?.message || "Failed to authenticate with Google." };
    }

    // 4. Send via FCM HTTP v1
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    await Promise.all(
      tokens.map(async (token) => {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                data: customData,
              },
            }),
          });
          if (res.ok) {
            sent++;
          } else {
            failed++;
            const errBody = await res.text();
            console.warn(`FCM send failed (${res.status}):`, errBody);
            if (res.status === 404 || res.status === 400) {
              invalidTokens.push(token);
            }
          }
        } catch (e) {
          failed++;
          console.error("FCM send exception:", e);
        }
      }),
    );

    // 5. Cleanup invalid tokens
    if (invalidTokens.length > 0) {
      await (supabaseAdmin as any)
        .from("profiles")
        .update({ fcm_token: null })
        .in("fcm_token", invalidTokens);
    }

    return { success: sent > 0, count: sent, failed };
  });
