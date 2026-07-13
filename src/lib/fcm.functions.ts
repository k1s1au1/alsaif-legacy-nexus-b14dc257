import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const sendFcmNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      title: z.string().min(1).max(120),
      body: z.string().min(1).max(300),
      roles: z.array(z.string().max(40)).max(10).optional(),
      route: z.string().max(200).optional(),
      category: z.string().max(100).optional(),
      data: z.record(z.string().max(500)).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await getSupabaseAdmin();
    if (!admin) return { success: false };

    let userIds: string[] = [];
    if (data.roles?.length) {
      const { data: roleRows } = await admin
        .from("user_roles")
        .select("user_id")
        .in("role", data.roles);
      userIds = (roleRows ?? []).map((row) => row.user_id);
    } else {
      const { data: members } = await admin.from("profiles").select("id");
      userIds = (members ?? []).map((member) => member.id);
    }

    userIds = userIds.filter((id) => id !== context.userId);
    if (!userIds.length) return { success: true, count: 0 };

    const { data: result, error } = await admin.functions.invoke("send-push", {
      body: {
        title: data.title,
        body: data.body,
        user_ids: userIds,
        url: data.route || "/dashboard",
        category: data.category,
        data: data.data,
      },
    });
    if (error) throw error;
    return { success: true, count: result?.sent ?? 0 };
  });
