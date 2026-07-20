import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: p } = await supabase
        .from("profiles")
        .select("arabic_name, full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

      const rs = (r ?? []).map((x) => x.role);
      const name = p?.arabic_name || p?.full_name || user.email?.split("@")[0] || "عضو العائلة";

      return {
        id: user.id,
        name,
        role: rs.includes("admin")
          ? "مسؤول تقني"
          : rs.includes("chairman")
            ? "رئيس المجلس"
            : "عضو المجلس",
        initial: (name[0] || "ع").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useDashboardCounts() {
  return useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [
        { count: mCount },
        { count: tCount },
        { count: myTCount },
        { count: newsCount },
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("assignee_id", user.id)
          .neq("status", "done"),
        supabase
          .from("majlis_posts")
          .select("id", { count: "exact", head: true })
          .gt("created_at", yesterday),
      ]);

      return {
        members: mCount || 0,
        tasks: tCount || 0,
        myTasks: myTCount || 0,
        newNews: newsCount || 0,
      };
    },
    refetchInterval: 1000 * 60 * 2, // 2 minutes
  });
}

export function useUpcomingEvents() {
  return useQuery({
    queryKey: ["upcoming-events"],
    queryFn: async () => {
      const supabase = getSupabase();
      const now = new Date().toISOString();

      const [{ data: meetings }, { data: trips }] = await Promise.all([
        supabase
          .from("meetings")
          .select("*")
          .gte("scheduled_at", now)
          .order("scheduled_at")
          .limit(5),
        supabase.from("trips").select("*").gte("start_date", now).order("start_date").limit(5),
      ]);

      return {
        meetings: meetings || [],
        trips: trips || [],
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useDashboardAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: posts } = await supabase
        .from("majlis_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      if (!posts) return [];

      const annList = posts
        .filter(
          (p) =>
            (p.kind === "announcement" || p.body?.includes("---kind:announcement")) &&
            !p.body?.includes("---poll:"),
        )
        .slice(0, 5);

      return Promise.all(
        annList.map(async (a) => {
          const imgMatch = (a.body || "").match(/^---image:(.*)\n/);
          let url = null;
          if (imgMatch) {
            const { data } = await supabase.storage
              .from("trip-images")
              .createSignedUrl(imgMatch[1].trim(), 3600);
            url = data?.signedUrl;
          }
          return {
            ...a,
            imageUrl: url,
            cleanBody: (a.body || "")
              .replace(/^---image:.*\n/, "")
              .replace(/^---kind:.*\n/, "")
              .trim(),
            _label: a.kind === "announcement" ? "إعلان المجلس" : "أخبار السيف",
          };
        }),
      );
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useFundBalance() {
  return useQuery({
    queryKey: ["fund-balance"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: tx } = await supabase.from("fund_transactions").select("amount, type");
      if (!tx) return 0;
      return tx.reduce(
        (acc, t) => (t.type === "contribution" ? acc + Number(t.amount) : acc - Number(t.amount)),
        0,
      );
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useHeritageSnippet() {
  return useQuery({
    queryKey: ["heritage-snippet"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data: posts } = await supabase
        .from("majlis_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      const heritage = (posts ?? []).find((p) => p.title?.includes("[إرث]"));
      if (!heritage) return null;

      return {
        ...heritage,
        title: heritage.title.replace("[إرث]", "").trim(),
        cleanBody: (heritage.body || "")
          .replace(/---kind:.*\n/, "")
          .replace(/---image:.*\n/, "")
          .trim(),
      };
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
