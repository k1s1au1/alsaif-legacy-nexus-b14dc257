import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { Loader2, Search, Users, ShieldCheck, Mail, MapPin, ChevronLeft } from "lucide-react";
import { PresenceDot, presenceFromLastSeen, type PresenceState } from "@/lib/presence";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";

export const Route = createFileRoute("/_authenticated/members/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الأعضاء — السيف" },
      { name: "description", content: "تصفح ملفات تعريف جميع أعضاء نظام عائلة السيف." },
    ],
  }),
  component: MembersPage,
});

type MemberRow = {
  id: string;
  arabic_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  father_name?: string | null;
};

function MembersPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [presence, setPresence] = useState<Record<string, string>>({});
  const [, setTick] = useState(0);
  const [q, setQ] = useState("");
  const [me, setMe] = useState<{ name: string; initial: string; avatarPath: string | null }>({
    name: "...",
    initial: "س",
    avatarPath: null,
  });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, arabic_name, full_name, avatar_url, father_name")
        .order("arabic_name", { ascending: true });
      if (!error && data) setMembers(data as MemberRow[]);
      if (u.user) {
        const mine = (data as MemberRow[] | null)?.find((m) => m.id === u.user!.id);
        const name =
          mine?.arabic_name?.trim() ||
          mine?.full_name?.trim() ||
          u.user.email?.split("@")[0] ||
          "عضو";
        setMe({ name, initial: (name[0] ?? "س").toUpperCase(), avatarPath: mine?.avatar_url ?? null });
      }
      setLoading(false);
    })();

    const loadPresence = async () => {
      const { data } = await supabase.from("user_presence").select("user_id, last_seen_at");
      if (data) {
        const map: Record<string, string> = {};
        for (const r of data) map[r.user_id] = r.last_seen_at;
        setPresence(map);
      }
    };
    loadPresence();

    const channel = supabase
      .channel("members-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, loadPresence)
      .subscribe();

    const tickId = window.setInterval(() => setTick((t) => t + 1), 30_000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(tickId);
    };
  }, []);

  const filtered = members.filter((m) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      (m.arabic_name ?? "").toLowerCase().includes(needle) ||
      (m.full_name ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <AppShell title="الأعضاء" user={{ name: me.name, role: "عضو", initial: me.initial, avatarPath: me.avatarPath }}>
      <div className="max-w-7xl mx-auto space-y-12 pb-24" dir="rtl">

        {/* Royal Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-up">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="size-1 w-10 bg-gold-primary rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">دليل العائلة</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-primary">أعضاء مجلس السيف</h2>
            <p className="text-muted-foreground font-bold text-lg opacity-70">تعرف على أفراد عائلتك وتواصل معهم في مجلسنا الرقمي.</p>
          </div>
          <div className="flex items-center gap-3 bg-primary/5 px-6 py-3 rounded-full border border-primary/10 shadow-inner">
             <Users className="size-6 text-primary" />
             <span className="text-xl font-black text-primary tracking-tighter">{members.length} عضو مسجل</span>
          </div>
        </section>

        {/* Search & Filter Bar */}
        <section className="animate-fade-up" style={{ animationDelay: "100ms" }}>
           <div className="relative group">
              <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none">
                 <Search className="size-5 text-muted-foreground group-focus-within:text-primary transition-colors" strokeWidth={2.5} />
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن فرد من العائلة بالاسم..."
                className="w-full h-16 pr-16 pl-8 rounded-[28px] bg-card border border-border shadow-xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-bold text-lg"
              />
           </div>
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-40">
             <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
             <p className="font-black">جاري تحضير دليل العائلة...</p>
          </div>
        ) : (
          <div className="space-y-12">
            <AnimatePresence mode="wait">
              {filtered.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="card-surface p-20 flex flex-col items-center text-center gap-6 border-dashed opacity-40"
                >
                  <Users className="size-20" strokeWidth={1} />
                  <div className="space-y-1">
                    <p className="text-xl font-black">لا توجد نتائج مطابقة</p>
                    <p className="text-sm font-bold opacity-60">تأكد من كتابة الاسم بشكل صحيح أو جرب كلمات أخرى.</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                >
                  {filtered.map((m, i) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      index={i}
                      presenceTime={presence[m.id]}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function MemberCard({ member, index, presenceTime }: { member: MemberRow; index: number; presenceTime?: string }) {
  const displayName = member.arabic_name?.trim() || member.full_name?.trim() || "عضو العائلة";
  const state: PresenceState = presenceFromLastSeen(presenceTime);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        to="/members/$userId"
        params={{ userId: member.id }}
        className="group relative block"
      >
        <div className="card-surface p-6 flex flex-col items-center text-center gap-4 hover:-translate-y-2 hover:shadow-2xl hover:border-gold-primary/30 transition-all duration-500 overflow-hidden h-full">

           {/* Background Mark Decor */}
           <div className="absolute top-0 left-0 opacity-[0.02] -translate-x-1/3 -translate-y-1/3 pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-700">
              <img src={alsaifMark.url} className="size-32" alt="" />
           </div>

           {/* Avatar Section */}
           <div className="relative">
              <div className="size-24 rounded-[32px] ring-4 ring-primary/5 group-hover:ring-primary/10 bg-muted overflow-hidden transition-all duration-500 shadow-lg">
                 <UserAvatar
                    path={member.avatar_url}
                    name={displayName}
                    className="size-full object-cover transition-transform duration-700 group-hover:scale-110"
                    userId={member.id}
                 />
              </div>
              <div className="absolute -bottom-1 -left-1 ring-4 ring-card rounded-full shadow-lg">
                <PresenceDot state={state} className="size-5 border-2 border-card" />
              </div>
           </div>

           {/* Info Section */}
           <div className="space-y-1 w-full">
              <h4 className="text-lg font-black text-primary truncate group-hover:text-gold-primary transition-colors">{displayName}</h4>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">عضو مجلس العائلة</p>
           </div>

           <div className="w-full h-px bg-border/40 my-2" />

           <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600">
                 <ShieldCheck className="size-3.5" />
                 <span className="text-[10px] font-black uppercase tracking-tighter">حساب نشط</span>
              </div>
              <ChevronLeft className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
           </div>

        </div>
      </Link>
    </motion.div>
  );
}
