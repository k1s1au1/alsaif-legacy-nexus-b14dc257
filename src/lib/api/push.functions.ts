import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const NOTIFICATION_TYPES = ["meetings", "entertainment", "tasks", "chat", "news"] as const;

export const sendPushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    title: z.string().min(1).max(150),
    body: z.string().min(1).max(300),
    type: z.enum(NOTIFICATION_TYPES).optional(),
    target_user_ids: z.array(z.string().uuid()).max(2000).optional(),
    route: z.string().max(200).optional(),
  }))
  .handler(async ({ data }) => {
    return { success: true };
  });
