import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const sendFcmNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { title: string, body: string, roles?: string[], data?: Record<string, string> }) =>
    z.object({
      title: z.string().min(1).max(120),
      body: z.string().min(1).max(300),
      roles: z.array(z.string().max(40)).max(10).optional(),
      data: z.record(z.string().max(500)).optional()
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdmin();
    if (!admin) return { success: false };
    // Logic...
    return { success: true };
  });
