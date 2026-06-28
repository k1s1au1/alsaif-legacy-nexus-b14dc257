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
    const isManager = rs.includes("manager");

    // Fallback: If no users have any role yet, allow the first one to setup
    const { count: totalRoles } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true });

    const isAuthorized = isAdmin || isChairman || isManager;

    if (!isAuthorized && totalRoles !== 0) {
      throw new Error("غير مصرح لك بتغيير الصلاحيات");
    }

    // Managers cannot assign admin/chairman, and cannot modify admins
    if (!isAdmin && !isChairman) {
      if (role === "admin" || role === "chairman") {
        throw new Error("فقط المسؤول أو رئيس المجلس يمكنه تعيين هذه الصلاحية");
      }
      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if ((targetRoles ?? []).some((r: any) => r.role === "admin" || r.role === "chairman")) {
        throw new Error("لا يمكن تعديل صلاحيات المسؤول أو رئيس المجلس");
      }
    }


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // If assigning chairman, demote any existing chairman first (only one allowed)
    if (role === "chairman") {
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
