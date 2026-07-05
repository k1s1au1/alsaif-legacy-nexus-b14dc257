import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const deleteMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ userId: z.string() }))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Unauthorized");
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await getSupabaseAdmin();
    if (!admin) throw new Error("Server error");

    await admin.auth.admin.deleteUser(data.userId);
    return { ok: true };
  });
