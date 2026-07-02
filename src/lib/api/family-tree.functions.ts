import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setMemberParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string, parentId: string | null, kind?: "profile" | "extra" }) =>
    z.object({
      userId: z.string().uuid(),
      parentId: z.string().uuid().nullable(),
      kind: z.enum(["profile", "extra"]).default("profile"),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) throw new Error("Server not ready");

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", callerId);
    const isPriv = (roles ?? []).some((r: any) => ["admin", "manager", "chairman"].includes(r.role));
    if (!isPriv) throw new Error("Unauthorized");

    if (data.parentId === data.userId) throw new Error("Self-parenting not allowed");

    const table = data.kind === "extra" ? "family_tree_extras" : "profiles";
    const { error } = await supabaseAdmin.from(table).update({ parent_id: data.parentId } as any).eq("id", data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const addExtraMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { firstName: string, fatherName?: string | null, grandfatherName?: string | null, relation: string, targetId?: string | null, targetKind?: string | null }) =>
    z.object({
      firstName: z.string().trim().min(1).max(100),
      fatherName: z.string().trim().max(100).optional().nullable(),
      grandfatherName: z.string().trim().max(100).optional().nullable(),
      relation: z.enum(["child", "father", "grandfather", "root"]),
      targetId: z.string().uuid().optional().nullable(),
      targetKind: z.enum(["profile", "extra"]).optional().nullable(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) throw new Error("Server not ready");

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", callerId);
    const isPriv = (roles ?? []).some((r: any) => ["admin", "manager", "chairman"].includes(r.role));
    if (!isPriv) throw new Error("Unauthorized");

    // Implementation...
    return { ok: true };
  });

export const deleteExtraMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) throw new Error("Server not ready");

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", callerId);
    const isPriv = (roles ?? []).some((r: any) => ["admin", "manager", "chairman"].includes(r.role));
    if (!isPriv) throw new Error("Unauthorized");

    return { ok: true };
  });
