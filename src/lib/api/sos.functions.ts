import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends a high-priority help request to family administrators and chosen members. */
export const sendSosAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      note: z.string().trim().max(240).optional(),
      recipient_ids: z.array(z.string().uuid()).max(10).default([]),
    }),
  )
  .handler(async ({ data, context }) => {
    try {
      const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = await getSupabaseAdmin();
      if (!admin) throw new Error("Admin client not ready");

      const [profileResult, rolesResult] = await Promise.all([
        admin
          .from("profiles")
          .select("arabic_name, full_name")
          .eq("id", context.userId)
          .maybeSingle(),
        admin
          .from("user_roles")
          .select("user_id")
          .in("role", ["chairman", "admin", "manager"]),
      ]);

      const senderName =
        profileResult.data?.arabic_name || profileResult.data?.full_name || "أحد أفراد العائلة";
      const managers = (rolesResult.data ?? []).map((role) => role.user_id);
      const targetIds = Array.from(new Set([...managers, ...data.recipient_ids])).filter(
        (id) => id !== context.userId,
      );

      if (targetIds.length === 0) {
        return { success: false, count: 0, error: "لا توجد جهات طوارئ متاحة" };
      }

      const detail = data.note ? ` — ${data.note}` : "";
      const { data: pushResult, error: pushError } = await admin.functions.invoke("send-push", {
        body: {
          title: `🆘 نداء طوارئ من ${senderName}`,
          body: `يحتاج المساعدة العاجلة${detail}`,
          user_ids: targetIds,
          url: "/dashboard",
          category: "SOS",
          data: { sender_id: context.userId, type: "sos" },
        },
      });

      if (pushError) throw pushError;
      return { success: true, count: pushResult?.sent ?? 0 };
    } catch (error) {
      console.error("sendSosAlert error", error);
      return { success: false, count: 0, error: "تعذر إرسال نداء الطوارئ" };
    }
  });
