// Edge function: send-push
// Sends FCM v1 push notifications to devices from public.push_tokens.
// Invoked by DB triggers via pg_net or from client code.

// deno-lint-ignore-file no-explicit-any

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
  if (!data.access_token) throw new Error(`OAuth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const {
      title,
      body,
      url,
      image,
      user_ids,
      exclude_user_id,
    }: {
      title: string;
      body: string;
      url?: string;
      image?: string;
      user_ids?: string[];
      exclude_user_id?: string;
    } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SA_RAW = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!SA_RAW) throw new Error("FCM_SERVICE_ACCOUNT secret is not set");

    const sa = JSON.parse(SA_RAW);
    const projectId = sa.project_id;

    // Fetch tokens
    const params = new URLSearchParams({
      select: "token,user_id",
      is_active: "eq.true",
    });
    if (user_ids && user_ids.length > 0) {
      params.append("user_id", `in.(${user_ids.join(",")})`);
    }
    const tokRes = await fetch(`${SUPABASE_URL}/rest/v1/push_tokens?${params.toString()}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    const rows: { token: string; user_id: string }[] = await tokRes.json();
    const tokens = rows
      .filter((r) => (exclude_user_id ? r.user_id !== exclude_user_id : true))
      .map((r) => r.token)
      .filter((t) => !!t);

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(sa);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let sent = 0;
    const invalidTokens: string[] = [];
    await Promise.all(
      tokens.map(async (token) => {
        const message = {
          message: {
            token,
            notification: {
              title,
              body,
              image: image || undefined,
            },
            data: url ? { url } : {},
            android: {
              priority: "HIGH",
              notification: {
                sound: "default",
                click_action: "FLUTTER_NOTIFICATION_CLICK",
                color: "#064E3B", // Emerald Green for identity
                image: image || undefined,
              },
            },
            webpush: {
              headers: { image: image || "" },
              notification: { title, body, icon: "/favicon.ico", image: image || "" },
              fcm_options: { link: url || "/" },
            },
          },
        };
        const r = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        });
        if (r.ok) {
          sent++;
        } else {
          const errText = await r.text();
          if (
            r.status === 404 ||
            errText.includes("UNREGISTERED") ||
            errText.includes("INVALID_ARGUMENT")
          ) {
            invalidTokens.push(token);
          }
          console.warn("FCM send failed", r.status, errText);
        }
      }),
    );

    // Deactivate invalid tokens
    if (invalidTokens.length > 0) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_tokens?token=in.(${invalidTokens.map(encodeURIComponent).join(",")})`,
        {
          method: "PATCH",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_active: false }),
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        total: tokens.length,
        invalidated: invalidTokens.length,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("send-push error", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
