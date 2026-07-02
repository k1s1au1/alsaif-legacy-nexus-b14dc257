import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const approveAccountRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Server error");

    // 1. Verify privilege
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isPriv = (roles ?? []).some((r: any) => ["admin", "chairman"].includes(r.role));
    if (!isPriv) throw new Error("Unauthorized");

    // 2. Get Request Details
    const { data: req } = await admin.from("account_requests").select("*").eq("id", data.id).single();
    if (!req) throw new Error("Request not found");

    // 3. Create Auth User
    const fullName = `${req.first_name} ${req.father_name}`;
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: req.email,
      password: req.desired_password,
      email_confirm: true,
      user_metadata: { full_name: fullName, arabic_name: fullName }
    });

    if (authErr) throw authErr;

    // 4. Update Tables
    await admin.from("profiles").upsert({ id: authUser.user.id, arabic_name: fullName, full_name: fullName, phone: req.phone });
    await admin.from("user_roles").insert({ user_id: authUser.user.id, role: "member" });
    await admin.from("account_requests").update({ status: "approved" }).eq("id", data.id);

    return { ok: true };
  });
