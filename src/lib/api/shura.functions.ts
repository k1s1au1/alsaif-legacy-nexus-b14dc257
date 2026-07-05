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

    if (percentage < (pollData.threshold || 70)) throw new Error("Threshold not met");

    const newChairmanId = pollData.target_uid;
    await admin.from("user_roles").delete().eq("role", "chairman");
    await admin.from("user_roles").upsert({ user_id: newChairmanId, role: "chairman" }, { onConflict: "user_id,role" });

    return { success: true };
  });
