import { createServerFn } from "@tanstack/react-start";

export const getPublicStats = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = getSupabaseAdmin();
      if (!admin) return { members: 0, completedTasks: 0 };

      const [{ count: mCount }, { count: tCount }] = await Promise.all([
        admin.from("profiles").select("*", { count: 'exact', head: true }),
        admin.from("tasks").select("*", { count: 'exact', head: true }).eq("status", "done")
      ]);

      return {
        members: mCount || 0,
        completedTasks: tCount || 0
      };
    } catch (err) {
      console.error("Public stats error:", err);
      return { members: 0, completedTasks: 0 };
    }
  });
