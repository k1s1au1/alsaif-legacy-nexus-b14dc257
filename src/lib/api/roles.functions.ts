import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const assignUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string, role: string }) => z.object({ userId: z.string(), role: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Server error");

    // Verify caller
    const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", context.userId);
    const isPriv = (callerRoles ?? []).some((r: any) => ["admin", "chairman"].includes(r.role));
    if (!isPriv) throw new Error("Unauthorized");

    // Execute
    await admin.from("user_roles").delete().eq("user_id", data.userId);
    await admin.from("user_roles").insert({ user_id: data.userId, role: data.role as any });

    return { success: true };
  });
