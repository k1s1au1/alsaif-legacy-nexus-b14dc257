import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const NOTIFICATION_TYPES = ["meetings", "entertainment", "tasks", "chat", "news"] as const;

export const sendPushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { title: string; body: string; type?: string; target_user_ids?: string[]; route?: string }) => {
    return z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      type: z.string().optional(),
      target_user_ids: z.array(z.string().uuid()).optional(),
      route: z.string().optional()
    }).parse(data);
  })
  .handler(async ({ data }) => {
    try {
      const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = getSupabaseAdmin();
      if (!admin) return { success: false, error: "Server not initialized" };

      const { sendFcmV1 } = await import("../fcm-service.server");
      const { data: profiles } = await admin.from("profiles").select("fcm_token");
      const tokens = (profiles ?? []).map((p: any) => p.fcm_token).filter(Boolean);

      if (tokens.length === 0) return { success: true, count: 0 };

      const count = await sendFcmV1(data.title, data.body, tokens, { route: data.route || "" });
      return { success: true, count };
    } catch (e: any) {
      console.error("[Push Error]:", e.message);
      return { success: false, error: e.message };
    }
  });
