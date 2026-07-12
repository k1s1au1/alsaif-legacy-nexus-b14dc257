import { createServerFn } from "@tanstack/react-start";

export const getPublicStats = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [{ count: mCount }, { count: tCount }] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("tasks").select("*", { count: "exact", head: true }).eq("status", "done"),
    ]);

    return { members: mCount || 0, completedTasks: tCount || 0 };
  } catch {
    return { members: 0, completedTasks: 0 };
  }
});
