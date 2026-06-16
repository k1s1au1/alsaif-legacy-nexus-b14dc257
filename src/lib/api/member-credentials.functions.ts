import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMemberCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Only admins may view stored credentials
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("غير مصرح");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Resolve the target user's email. Passwords are no longer stored in the
    // database — admins must send a password reset link instead.
    const { data: userRes, error: userErr } =
      await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (userErr || !userRes?.user?.email) {
      return { email: null, password: null };
    }
    return { email: userRes.user.email, password: null };
  });
