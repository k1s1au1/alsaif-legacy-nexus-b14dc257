import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const sendPushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      title: z.string().min(1).max(150),
      body: z.string().min(1).max(300),
      type: z.enum(["meetings", "entertainment", "tasks", "chat", "news"]).optional(),
      target_user_ids: z.array(z.string().uuid()).max(2000).optional(),
      route: z.string().max(200).optional(),
      category: z.string().max(100).optional(),
      data: z.record(z.string().max(500)).optional(),
    }),
  )
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

      const { data: pushResult, error } = await admin.functions.invoke("send-push", {
        body: {
          title: data.title,
          body: data.body,
          user_ids: userIds,
          url: data.route,
          category: data.category,
          data: data.data
        }
      });

      if (error) throw error;
      return { success: true, count: pushResult?.sent || 0 };
    } catch (e: any) {
      console.error("sendPushNotification error", e);
      return { success: false, error: "تعذّر إرسال الإشعار" };
    }
  });
