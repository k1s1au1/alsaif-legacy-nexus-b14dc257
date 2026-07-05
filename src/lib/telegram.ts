import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const sendTelegramNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ message: z.string().min(1).max(1000) }))
  .handler(async ({ data }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await getSupabaseAdmin();
    if (!admin) return { success: false };
    // Logic...
    return { success: true };
  });
