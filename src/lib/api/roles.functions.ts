import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Server function to assign roles to users.
 * Uses service role to bypass RLS for initial setup or admin actions.
 */
export const assignUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    userId: z.string(),
    role: z.string()
  }).parse(data))
  .handler(async ({ data: { userId, role }, context }) => {
    const { supabase, userId: callerId } = context;

    // 0. Verify authorization
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    const rs = (roles ?? []).map((r: any) => r.role);
    const isAuthorized = rs.includes("admin") || rs.includes("chairman");

    // Fallback: If no users have any role yet, allow the first one to setup
    const { count: totalRoles } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true });

    if (!isAuthorized && totalRoles !== 0) {
      throw new Error("غير مصرح لك بتغيير الصلاحيات");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Delete existing roles
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    // 2. Insert new role
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: role as any
      });

    if (error) {
      console.error("Role assignment error:", error);
      throw new Error("فشل تعيين الصلاحية: " + error.message);
    }

    return { success: true };
  });
