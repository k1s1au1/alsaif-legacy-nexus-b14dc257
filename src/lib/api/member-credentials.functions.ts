import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMemberCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) throw new Error("Server not ready");

    // Resolve...
    return { email: null, password: null };
  });
