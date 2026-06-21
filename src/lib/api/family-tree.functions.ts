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
    return { ok: true };
  });

export const addFamilyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        parentId: z.string().uuid().nullable(),
        firstName: z.string().min(2),
        fatherName: z.string().min(2),
        grandfatherName: z.string().min(2),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Use the regular supabase client which respects RLS
    // We assume there's a policy allowing admins/managers to insert profiles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isPriv = (roles ?? []).some(
      (r: { role: string }) => r.role === "admin" || r.role === "manager",
    );

    if (!isPriv) throw new Error("غير مصرّح");

    const fullName = `${data.firstName} ${data.fatherName} ${data.grandfatherName} السيف`.trim();

    const { error } = await supabase.from("profiles").insert({
      id: crypto.randomUUID(),
      first_name: data.firstName,
      father_name: data.fatherName,
      grandfather_name: data.grandfatherName,
      full_name: fullName,
      arabic_name: fullName,
      parent_id: data.parentId,
      is_active: false,
    } as any);

    if (error) {
      console.error("Profile insert error:", error);
      throw new Error(error.message);
    }

    return { ok: true };
  });
