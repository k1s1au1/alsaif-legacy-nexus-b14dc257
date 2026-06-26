import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sends a push notification to all registered devices via FCM.
 * Requires FCM_SERVER_KEY (for Legacy) or FCM_SERVICE_ACCOUNT_JSON (for V1) in env.
 * For simplicity in this environment, we'll implement a generic sender.
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
    // 1. Fetch all tokens from DB
    const { data: tokens, error: tokenErr } = await (supabase as any)
      .from("user_fcm_tokens")
      .select("token");

    if (tokenErr || !tokens || tokens.length === 0) {
      console.log("No FCM tokens found to notify.");
      return { success: true, count: 0 };
    }

    const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY;
    if (!FCM_SERVER_KEY) {
      console.warn("FCM_SERVER_KEY is missing in environment variables.");
      return { success: false, error: "FCM Configuration missing" };
    }

    const registration_ids = (tokens as Array<{ token: string }>).map(t => t.token);

    try {
      // Using Legacy FCM API for simple implementation with a single Key
      // Recommendation: Upgrade to V1 API for production
      const response = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `key=${FCM_SERVER_KEY}`
        },
        body: JSON.stringify({
          registration_ids,
          notification: {
            title,
            body,
            sound: "default",
            click_action: "OPEN_ACTIVITY"
          },
          data: customData,
          priority: "high"
        })
      });

      const result = await response.json();
      console.log("FCM Broadcast result:", result);

      return { success: true, result };
    } catch (error) {
      console.error("FCM Send Error:", error);
      return { success: false, error: "Failed to send FCM" };
    }
  });
