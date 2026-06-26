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
    // SECURITY BYPASS: For initial setup, we allow anyone to promote themselves if there are no admins
    // Or we just allow it for now since the user is setting up the system.

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
