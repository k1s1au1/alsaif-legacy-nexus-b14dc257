import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const notifyAdminsOfNewRequest = createServerFn({ method: "POST" })
  .validator(z.object({
    name: z.string().min(1).max(200)
  }))
  .handler(async ({ data }) => {
    try {
      const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = await getSupabaseAdmin();
      if (!admin) throw new Error("Admin client not ready");

      // 1. Get all Technical Admins and Chairmen
      const { data: privUsers } = await admin
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "chairman"]);

      const adminIds = Array.from(new Set((privUsers || []).map(u => u.user_id)));
      if (adminIds.length === 0) return { success: true, count: 0 };

      // 2. Call the send-push edge function for these admins
      const { data: pushResult, error: pushErr } = await admin.functions.invoke("send-push", {
        body: {
          title: "👤 طلب عضوية جديد",
          body: `قدم ${data.name} طلباً للانضمام لعائلة السيف. يرجى المراجعة والقبول.`,
          user_ids: adminIds,
          url: "/admin"
        }
      });

      if (pushErr) throw pushErr;

      return { success: true, result: pushResult };
    } catch (e) {
      console.error("notifyAdminsOfNewRequest error", e);
      return { success: false };
    }
  });
