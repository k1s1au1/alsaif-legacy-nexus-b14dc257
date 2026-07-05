import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const setMemberParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    userId: z.string().uuid(),
    parentId: z.string().uuid().nullable(),
    kind: z.enum(["profile", "extra"]).default("profile"),
  }))
  .handler(async ({ data }) => {
    return { ok: true };
  });

export const addExtraMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    firstName: z.string().trim().min(1).max(100),
    fatherName: z.string().trim().max(100).optional().nullable(),
    grandfatherName: z.string().trim().max(100).optional().nullable(),
    relation: z.enum(["child", "father", "grandfather", "root"]),
    targetId: z.string().uuid().optional().nullable(),
    targetKind: z.enum(["profile", "extra"]).optional().nullable(),
  }))
  .handler(async ({ data }) => {
    return { ok: true };
  });

export const deleteExtraMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    return { ok: true };
  });
