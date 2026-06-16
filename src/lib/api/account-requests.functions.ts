import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const approveAccountRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is admin or manager
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isPriv = (roles ?? []).some(
      (r: { role: string }) => r.role === "admin" || r.role === "manager",
    );
    if (!isPriv) throw new Error("غير مصرح");

    // Load the request
    const { data: req, error: reqErr } = await supabase
      .from("account_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (reqErr || !req) throw new Error("الطلب غير موجود");
    if (!req.email) throw new Error("الطلب يفتقد البريد الإلكتروني");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const fullName = [req.first_name, req.father_name, req.grandfather_name]
      .filter(Boolean)
      .join(" ");

    // Invite the user by email. Supabase sends an invite email; the user
    // clicks the link and sets their own password — no plain-text password
    // is ever stored by the app.
    let newUserId: string | null = null;
    const { data: invited, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(req.email, {
        data: { full_name: fullName, arabic_name: fullName },
      });

    if (inviteErr) {
      const msg = inviteErr.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered")) {
        // User already exists — locate them and (re-)send a recovery email
        const { data: list } = await supabaseAdmin.auth.admin.listUsers();
        const existing = list?.users.find(
          (u) => u.email?.toLowerCase() === req.email!.toLowerCase(),
        );
        if (!existing) throw new Error("المستخدم موجود لكن تعذر تحديده");
        newUserId = existing.id;
        // Best-effort password reset email; ignore failure (admin can resend)
        await supabaseAdmin.auth.resetPasswordForEmail(req.email).catch(() => {});
      } else {
        throw new Error(inviteErr.message || "تعذر إنشاء المستخدم");
      }
    } else {
      newUserId = invited.user?.id ?? null;
    }
    if (!newUserId) throw new Error("تعذر إنشاء المستخدم");

    // Upsert profile with three-part name and phone
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          first_name: req.first_name,
          father_name: req.father_name,
          grandfather_name: req.grandfather_name,
          phone: req.phone,
          full_name: fullName,
          arabic_name: fullName,
        },
        { onConflict: "id" },
      );

    // Ensure at least a member role exists
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: newUserId, role: "member" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    // Mark the request approved
    await supabaseAdmin
      .from("account_requests")
      .update({
        status: "approved",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    return { ok: true, userId: newUserId };
  });
