import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const executeLeadershipTransition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ postId: z.string().uuid() }))
  .handler(async ({ data: { postId } }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await getSupabaseAdmin();
    if (!admin) throw new Error("Server error");

    const { data: post } = await admin.from("majlis_posts").select("*").eq("id", postId).single();
    if (!post) throw new Error("Poll not found");

    const match = (post.body || "").match(/---poll:({.*?})---/s);
    if (!match) throw new Error("Invalid poll format");

    const pollData = JSON.parse(match[1]);
    const { data: votes } = await admin.from("majlis_comments").select("body").eq("post_id", postId).like("body", "[VOTE]:%");

    const yesVotes = (votes ?? []).filter(v => v.body === "[VOTE]:0").length;
    const totalVotes = (votes ?? []).length;
    const percentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;

    // Check for both old and new type names for compatibility
    const isLeadershipPoll = pollData.type === "leadership_shura" || pollData.type === "chairman";
    if (!isLeadershipPoll) throw new Error("This is not a leadership poll");

    if (percentage < (pollData.threshold || 70)) throw new Error("Threshold not met");

    const newChairmanId = pollData.target_uid;
    await admin.from("user_roles").delete().eq("role", "chairman");
    await admin.from("user_roles").upsert({ user_id: newChairmanId, role: "chairman" }, { onConflict: "user_id,role" });

    return { success: true };
  });

export const finalizePoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ postId: z.string().uuid() }))
  .handler(async ({ data: { postId } }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = await getSupabaseAdmin();
    if (!admin) throw new Error("Server error");

    // 1. Fetch Poll Details
    const { data: post } = await admin.from("majlis_posts").select("*").eq("id", postId).single();
    if (!post) throw new Error("Poll not found");

    const match = (post.body || "").match(/---poll:({.*?})---/s);
    if (!match) throw new Error("Invalid poll format");
    const pollData = JSON.parse(match[1]);

    // 2. Fetch Votes
    const { data: votes } = await admin.from("majlis_comments")
      .select("body, author_id, created_at")
      .eq("post_id", postId)
      .like("body", "[VOTE]:%");

    if (!votes || votes.length === 0) throw new Error("No votes found for this poll");

    // 3. Fetch Voter Profiles
    const voterIds = votes.map(v => v.author_id);
    const { data: profiles } = await admin.from("profiles")
      .select("id, arabic_name, full_name")
      .in("id", voterIds);

    const profMap = new Map();
    profiles?.forEach(p => profMap.set(p.id, p.arabic_name || p.full_name || "عضو"));

    // 4. Organize Data
    const options = pollData.options || ["نعم", "لا"];
    const results = options.map((opt, i) => {
      const voters = votes
        .filter(v => v.body === `[VOTE]:${i}`)
        .map(v => profMap.get(v.author_id));
      return { option: opt, count: voters.length, voters };
    });

    const totalVotes = votes.length;
    const dateStr = new Date().toLocaleDateString("ar-SA", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // 5. Generate Report Content (HTML/Text)
    // In a real environment with PDF libraries, we'd generate a PDF here.
    // For now, we'll create a very formal HTML report.
    const reportHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 40px; border: 1px solid #eee;">
        <h1 style="text-align: center; color: #064E3B;">محضر اجتماع رسمي — مجلس عائلة السيف</h1>
        <hr style="border-top: 2px solid #D4AF37; margin: 20px 0;">
        <p><strong>تاريخ التقرير:</strong> ${dateStr}</p>
        <p><strong>موضوع التصويت:</strong> ${post.title}</p>
        <p><strong>نص الاقتراح:</strong> ${pollData.question}</p>

        <h2 style="color: #064E3B; margin-top: 30px;">نتائج التصويت النهائية:</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f9f9f9;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">الخيار</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">عدد الأصوات</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">النسبة</th>
            </tr>
          </thead>
          <tbody>
            ${results.map(r => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 12px;">${r.option}</td>
                <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${r.count}</td>
                <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${Math.round((r.count / totalVotes) * 100)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2 style="color: #064E3B; margin-top: 30px;">سجل المصوتين:</h2>
        ${results.map(r => `
          <div style="margin-bottom: 20px;">
            <p><strong>المصوتون بـ (${r.option}):</strong></p>
            <p style="padding-right: 20px; color: #555;">${r.voters.join('، ') || "لا يوجد"}</p>
          </div>
        `).join('')}

        <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #888;">
          <p>تم استخراج هذا التقرير تلقائياً من نظام شورى عائلة السيف الرقمي</p>
          <p>جميع الحقوق محفوظة للعائلة © ${new Date().getFullYear()}</p>
        </div>
      </div>
    `;

    // 6. Upload to Vault Storage
    const fileName = `report-${postId}-${Date.now()}.html`;
    const filePath = `reports/${fileName}`;

    const { error: uploadError } = await admin.storage
      .from("vault-media")
      .upload(filePath, Buffer.from(reportHtml), {
        contentType: 'text/html',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 7. Insert into Secure Vault DB
    const { error: vaultError } = await admin.from("secure_vault" as any).insert({
      title: `محضر تصويت: ${post.title}`,
      description: `تقرير رسمي لنتائج التصويت على: ${pollData.question}`,
      category: "private", // Categorize as official/private document
      storage_path: filePath,
      owner_id: post.author_id,
      is_encrypted: true,
      shared_with: ["all"] // Make official reports visible to the family
    });

    if (vaultError) throw vaultError;

    // 8. Update Poll Status to "executed" or "closed"
    const newBody = post.body.replace(match[1], JSON.stringify({ ...pollData, status: "finalized" }));
    await admin.from("majlis_posts").update({ body: newBody }).eq("id", postId);

    return { success: true, fileName };
  });
