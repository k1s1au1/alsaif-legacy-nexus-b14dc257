import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const deleteMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string }) => z.object({ userId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Unauthorized");

    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) throw new Error("Server not ready");

    // Authorization...
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
