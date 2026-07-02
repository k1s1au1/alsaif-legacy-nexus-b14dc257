import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const sendTelegramNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { message: string }) => z.object({ message: z.string().min(1).max(1000) }).parse(data))
  .handler(async ({ data }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdmin();
    if (!admin) return { success: false };
    // Logic...
    return { success: true };
  });
