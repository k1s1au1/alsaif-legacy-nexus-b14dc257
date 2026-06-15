import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setMemberParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        parentId: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isPriv = (roles ?? []).some(
      (r: { role: string }) => r.role === "admin" || r.role === "manager",
    );
    if (!isPriv) throw new Error("غير مصرّح");

    if (data.parentId === data.userId) {
      throw new Error("لا يمكن جعل العضو والداً لنفسه");
    }

    // Prevent cycles: walk up parentId chain of the proposed parent
    if (data.parentId) {
      let cursor: string | null = data.parentId;
      const seen = new Set<string>();
      while (cursor) {
        if (cursor === data.userId) {
          throw new Error("هذا الاختيار يُنشئ حلقة في الشجرة");
        }
        if (seen.has(cursor)) break;
        seen.add(cursor);
        const { data: row } = (await supabase
          .from("profiles")
          .select("parent_id" as any)
          .eq("id", cursor)
          .maybeSingle()) as { data: { parent_id: string | null } | null };
        cursor = row?.parent_id ?? null;
      }
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ parent_id: data.parentId } as any)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
