import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMemberCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Only admins may view stored credentials
    const [{ data: isAdmin }, { data: isChairman }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: userId, _role: "chairman" }),
    ]);
    if (!isAdmin && !isChairman) throw new Error("غير مصرح");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Resolve the target user's email
    const { data: userRes, error: userErr } =
      await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (userErr || !userRes?.user?.email) {
      return { email: null, password: null };
    }
    const email = userRes.user.email;

    // Find the latest account request with the stored desired password
    const { data: req } = await supabaseAdmin
      .from("account_requests")
      .select("desired_password, created_at")
      .ilike("email", email)
      .not("desired_password", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { email, password: req?.desired_password ?? null };
  });
