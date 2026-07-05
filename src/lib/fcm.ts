import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const sendFcmNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(300),
    roles: z.array(z.string().max(40)).max(10).optional(),
    data: z.record(z.string().max(500)).optional()
  }))
  .handler(async ({ data }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await getSupabaseAdmin();
    if (!admin) return { success: false };
    // Logic...
    return { success: true };
  });
