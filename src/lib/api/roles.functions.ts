import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const assignUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ userId: z.string(), role: z.string() }))
  .handler(async ({ data: { userId, role }, context }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await getSupabaseAdmin();
    if (!admin) throw new Error("Server error");

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", context.userId);
    const isPriv = (roles ?? []).some((r: any) => ["admin", "chairman"].includes(r.role));
    if (!isPriv) throw new Error("Unauthorized");

    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert({ user_id: userId, role: role as any });

    return { success: true };
  });
