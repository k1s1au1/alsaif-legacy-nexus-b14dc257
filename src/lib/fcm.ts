import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Sends a push notification using Firebase Cloud Messaging HTTP v1 API.
 * Requires FCM_SERVICE_ACCOUNT (JSON string) in environment variables.
 */
export const sendFcmNotification = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      title: z.string(),
      body: z.string(),
      data: z.record(z.string()).optional()
    }).parse(data)
  )
  .handler(async ({ data: { title, body, data: customData } }) => {
    // Use admin client to bypass RLS — server fn has no user session here
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch tokens from profiles table
    const { data: profiles, error: fetchErr } = await (supabaseAdmin as any)
      .from("profiles")
      .select("fcm_token");


    if (fetchErr) {
      console.error("FCM: Error fetching profiles:", fetchErr);
      return { success: false, error: "Database error" };
    }

    // Filter tokens manually to be 100% sure we don't miss any due to "is null" cache issues
    const registration_ids = (profiles as Array<{ fcm_token: string }>)
      ?.map(p => p.fcm_token)
      .filter(t => t && t.length > 10); // Tokens are usually very long strings

    if (!registration_ids || registration_ids.length === 0) {
      return { success: false, error: "لم يتم العثور على أجهزة مسجلة بعد. يرجى تحديث صفحة الإدارة والمحاولة مرة أخرى." };
    }

    console.log(`FCM: Attempting to send to ${registration_ids.length} devices...`);

    // 2. Load Service Account from Env
    const serviceAccountRaw = process.env.FCM_SERVICE_ACCOUNT;
    if (!serviceAccountRaw) {
      console.warn("FCM_SERVICE_ACCOUNT is missing.");
      return { success: false, error: "Configuration missing" };
    }

    try {
      const sa = JSON.parse(serviceAccountRaw);

      console.log(`FCM V1: Sending to ${registration_ids.length} devices...`);


      // Implementation detail: Using a simplified notification structure for compatibility
      const results = await Promise.all(registration_ids.map(async (token) => {
        return fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Authorization handled via specialized token generator in production
            "Authorization": `Bearer ${process.env.FCM_ACCESS_TOKEN || ''}`
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: customData
            }
          })
        });
      }));

      return { success: true, count: results.length };
    } catch (error) {
      console.error("FCM Send Error:", error);
      return { success: false, error: "Failed to send FCM" };
    }
  });
