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
    const { userId: callerId } = context;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 0. Verify authorization using admin client (bypasses RLS quirks)
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    const rs = (roles ?? []).map((r: any) => r.role);
    const isAdmin = rs.includes("admin");
    const isChairman = rs.includes("chairman");

    // Fallback: If no users have any role yet, allow the first one to setup
    const { count: totalRoles } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true });

    // Only the chairman can change roles. Admin kept as system-level fallback
    // (technical owner) so the project never gets locked out.
    const isAuthorized = isChairman || isAdmin;

    if (!isAuthorized && totalRoles !== 0) {
      throw new Error("غير مصرح لك بتغيير الصلاحيات — هذه الصلاحية لرئيس المجلس فقط");
    }




    // If assigning chairman, ensure the target is not currently a manager,
    // then demote any existing chairman first (only one allowed)
    if (role === "chairman") {
      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const targetRoleList = (targetRoles ?? []).map((r: any) => r.role);
      if (targetRoleList.includes("manager")) {
        throw new Error("لا يمكن تعيين المشرف رئيسًا للمجلس. يجب تنزيله إلى عضو أولاً.");
      }

      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("role", "chairman");
    }

    // 1. Delete existing roles for this user
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
