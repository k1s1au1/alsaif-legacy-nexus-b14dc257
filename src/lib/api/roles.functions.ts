import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const assignUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string, role: string }) => z.object({
    userId: z.string(),
    role: z.string()
  }).parse(data))
  .handler(async ({ data: { userId, role }, context }) => {
    const { userId: callerId } = context;

    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) throw new Error("Server not ready");

    // 0. Verify authorization
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    const rs = (roles ?? []).map((r: any) => r.role);
    const isPriv = rs.includes("admin") || rs.includes("chairman");
    if (!isPriv) throw new Error("Unauthorized");

    // 1. Enforce Role Counts
    if (role === "admin" || role === "chairman") {
       const { count } = await supabaseAdmin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", role);
       const { data: existing } = await supabaseAdmin.from("user_roles").select("*").eq("user_id", userId).eq("role", role).maybeSingle();
       if ((count || 0) >= 2 && !existing) {
         throw new Error(`عذراً، لا يمكن تعيين أكثر من 2 ${role === 'admin' ? 'مسؤولين تقنيين' : 'رؤساء مجلس'}.`);
       }
    }

    // 2. Delete and Insert
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: role as any });
    if (error) throw new Error(error.message);

    return { success: true };
  });
