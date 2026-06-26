import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensurePriv(supabase: any, userId: string) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isPriv = (roles ?? []).some(
    (r: { role: string }) => r.role === "admin" || r.role === "manager" || r.role === "chairman",
  );
  if (!isPriv) throw new Error("غير مصرّح");
}

export const setMemberParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        parentId: z.string().uuid().nullable(),
        kind: z.enum(["profile", "extra"]).default("profile"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePriv(supabase, userId);

    if (data.parentId === data.userId) {
      throw new Error("لا يمكن جعل العضو والداً لنفسه");
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const table = data.kind === "extra" ? "family_tree_extras" : "profiles";
    const { error } = await supabaseAdmin
      .from(table)
      .update({ parent_id: data.parentId } as any)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const addExtraMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        firstName: z.string().trim().min(1).max(100),
        fatherName: z.string().trim().max(100).optional().nullable(),
        grandfatherName: z.string().trim().max(100).optional().nullable(),
        // Relation to a target node
        relation: z.enum(["child", "father", "grandfather", "root"]),
        targetId: z.string().uuid().optional().nullable(),
        targetKind: z.enum(["profile", "extra"]).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePriv(supabase, userId);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Determine new node's parent and any subsequent updates
    let newParentId: string | null = null;
    type Pending = { id: string; kind: "profile" | "extra"; parent_id: string | null };
    let updateTargetParent: Pending | null = null;

    async function fetchNode(id: string, kind: "profile" | "extra") {
      const table = kind === "extra" ? "family_tree_extras" : "profiles";
      const { data: row, error } = await supabaseAdmin
        .from(table)
        .select("id, parent_id")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("العضو المستهدف غير موجود");
      return row as { id: string; parent_id: string | null };
    }

    if (data.relation !== "root") {
      if (!data.targetId || !data.targetKind) {
        throw new Error("يجب اختيار عضو مرجعي");
      }
    }

    if (data.relation === "child") {
      newParentId = data.targetId!;
    } else if (data.relation === "father") {
      // New node becomes parent of target
      const target = await fetchNode(data.targetId!, data.targetKind!);
      newParentId = target.parent_id; // inherits target's parent (could be null)
      updateTargetParent = { id: target.id, kind: data.targetKind!, parent_id: target.parent_id };
    } else if (data.relation === "grandfather") {
      // New node becomes parent of target's father
      const target = await fetchNode(data.targetId!, data.targetKind!);
      if (!target.parent_id) {
        throw new Error("لا يمكن إضافة جد لعضو ليس له أب مسجّل. أضف الأب أولاً.");
      }
      // The father's kind is unknown — try profile first, then extra
      let fatherKind: "profile" | "extra" = "profile";
      let fatherRow = await supabaseAdmin
        .from("profiles")
        .select("id, parent_id")
        .eq("id", target.parent_id)
        .maybeSingle();
      if (!fatherRow.data) {
        fatherKind = "extra";
        fatherRow = await supabaseAdmin
          .from("family_tree_extras")
          .select("id, parent_id")
          .eq("id", target.parent_id)
          .maybeSingle();
        if (!fatherRow.data) throw new Error("الأب غير موجود");
      }
      newParentId = (fatherRow.data as any).parent_id;
      updateTargetParent = {
        id: (fatherRow.data as any).id,
        kind: fatherKind,
        parent_id: (fatherRow.data as any).parent_id,
      };
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("family_tree_extras")
      .insert({
        first_name: data.firstName,
        father_name: data.fatherName ?? null,
        grandfather_name: data.grandfatherName ?? null,
        parent_id: newParentId,
        created_by: userId,
      } as any)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    if (updateTargetParent) {
      const table =
        updateTargetParent.kind === "extra" ? "family_tree_extras" : "profiles";
      const { error: updErr } = await supabaseAdmin
        .from(table)
        .update({ parent_id: (inserted as any).id } as any)
        .eq("id", updateTargetParent.id);
      if (updErr) throw new Error(updErr.message);
    }

    return { ok: true, id: (inserted as any).id };
  });

export const deleteExtraMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePriv(supabase, userId);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Re-parent children (both profiles and extras) to this node's parent
    const { data: node } = await supabaseAdmin
      .from("family_tree_extras")
      .select("parent_id")
      .eq("id", data.id)
      .maybeSingle();
    const newParent = (node as any)?.parent_id ?? null;

    await supabaseAdmin
      .from("profiles")
      .update({ parent_id: newParent } as any)
      .eq("parent_id", data.id);
    await supabaseAdmin
      .from("family_tree_extras")
      .update({ parent_id: newParent } as any)
      .eq("parent_id", data.id);

    const { error } = await supabaseAdmin
      .from("family_tree_extras")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
