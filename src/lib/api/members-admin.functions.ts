import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) {
      throw new Error("لا يمكنك حذف حسابك الخاص");
    }

    const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
    ]);
    if (!isAdmin && !isManager) throw new Error("غير مصرّح");

    // Only admins can delete other admins
    const { data: targetIsAdmin } = await context.supabase.rpc("has_role", {
      _user_id: data.userId,
      _role: "admin",
    });
    if (targetIsAdmin && !isAdmin) throw new Error("لا يمكن حذف حساب مسؤول نظام");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
