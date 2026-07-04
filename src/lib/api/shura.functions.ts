import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Server function to execute a leadership transition after a successful Shura vote.
 * Requirements:
 * 1. Poll must be of type 'leadership_shura'.
 * 2. 'Yes' votes must meet the threshold (e.g., 70%).
 * 3. Only a system admin (technical admin) can trigger the actual swap to ensure safety,
 *    or it can be triggered by the success state itself.
 */
export const executeLeadershipTransition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { postId: string }) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ data: { postId }, context }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Server error");

    // 1. Fetch the poll post
    const { data: post, error: postErr } = await admin
      .from("majlis_posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (postErr || !post) throw new Error("Poll not found");

    const match = (post.body || "").match(/---poll:({.*?})---/s);
    if (!match) throw new Error("Invalid poll format");

    const pollData = JSON.parse(match[1]);
    if (pollData.type !== "leadership_shura") throw new Error("Not a leadership poll");

    // 2. Calculate votes
    const { data: votes } = await admin
      .from("majlis_comments")
      .select("body")
      .eq("post_id", postId)
      .like("body", "[VOTE]:%");

    const yesVotes = (votes ?? []).filter(v => v.body === "[VOTE]:0").length;
    const totalVotes = (votes ?? []).length;
    const percentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;

    if (percentage < (pollData.threshold || 70)) {
      throw new Error(`لم يتم الوصول للنصاب المطلوب (${pollData.threshold || 70}%)`);
    }

    // 3. Perform the swap
    const newChairmanId = pollData.target_uid;

    // Find current chairman
    const { data: currentChairman } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "chairman")
      .maybeSingle();

    // Begin transaction-like sequence
    if (currentChairman) {
      // Demote current chairman to member
      await admin.from("user_roles").update({ role: "member" }).eq("user_id", currentChairman.user_id).eq("role", "chairman");
    }

    // Promote new chairman
    await admin.from("user_roles").upsert({ user_id: newChairmanId, role: "chairman" }, { onConflict: "user_id,role" });

    // Mark poll as executed
    const updatedPollData = { ...pollData, status: "executed", executed_at: new Date().toISOString() };
    await admin.from("majlis_posts").update({
      body: post.body.replace(/---poll:({.*?})---/s, `---poll:${JSON.stringify(updatedPollData)}---`),
      pinned: false
    }).eq("id", postId);

    return { success: true, newChairman: pollData.target_name };
  });
